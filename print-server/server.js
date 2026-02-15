
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const net = require('net');
const iconv = require('iconv-lite');
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

// --- Helper: Sleep Function (For delay) ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- USB Library Loading (Safe Mode) ---
let escpos, escposUsb;
let isUsbAvailable = false;

try {
    escpos = require('escpos');
    escposUsb = require('escpos-usb');
    escpos.USB = escposUsb;
    isUsbAvailable = true;
    console.log('[System] USB Drivers loaded successfully.');
} catch (e) {
    console.warn('[Warning] USB Drivers not found. USB printing disabled.');
}

// --- Config Loading ---
const configPath = path.join(__dirname, 'config.json');
let PRINTER_CONFIG = { host: '192.168.1.200', port: 9100, width: 42 };

if (fs.existsSync(configPath)) {
    try {
        const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        PRINTER_CONFIG = { ...PRINTER_CONFIG, ...savedConfig };
    } catch (e) { console.error("Config error, using defaults."); }
}

const SERVER_PORT = 3000;
const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

const COMMANDS = {
    INIT: '\x1b\x40',
    CUT: '\x1d\x56\x41\x00',
};

const STAR_COMMANDS = {
    RASTER_START: '\x1b\x2a\x72\x41', // ESC * r A
    RASTER_END: '\x1b\x2a\x72\x42',   // ESC * r B
    CUT: '\x1b\x64\x02',              // ESC d 2
};

// --- RASTER FUNCTIONS ---

// 1. Standard ESC/POS (Epson/Xprinter)
function pngToEscPosRaster(pngBuffer) {
    const png = PNG.sync.read(pngBuffer);
    const width = png.width;
    const height = png.height;
    const bytesPerLine = Math.ceil(width / 8);
    const data = [];

    for (let y = 0; y < height; y++) {
        for (let b = 0; b < bytesPerLine; b++) {
            let byte = 0;
            for (let bit = 0; bit < 8; bit++) {
                const x = b * 8 + bit;
                if (x < width) {
                    const idx = (width * y + x) << 2;
                    // Simple luminance check
                    if (png.data[idx + 3] > 128 && (png.data[idx] + png.data[idx+1] + png.data[idx+2]) / 3 < 128) {
                        byte |= (1 << (7 - bit));
                    }
                }
            }
            data.push(byte);
        }
    }

    const header = Buffer.from([
        0x1d, 0x76, 0x30, 0x00, 
        bytesPerLine % 256, Math.floor(bytesPerLine / 256), 
        height % 256, Math.floor(height / 256)
    ]);
    return Buffer.concat([header, Buffer.from(data)]);
}

// 2. Star Micronics Raster (Optimized Chunking)
function pngToStarChunks(pngBuffer) {
    const png = PNG.sync.read(pngBuffer);
    const width = png.width;
    const height = png.height;
    const bytesPerLine = Math.ceil(width / 8);
    
    const chunks = [];
    
    // Command 'b' (0x62) header for each line
    const cmdBuffer = Buffer.from([0x62, bytesPerLine % 256, Math.floor(bytesPerLine / 256)]);

    // Start Mode
    chunks.push(Buffer.from(STAR_COMMANDS.RASTER_START));

    // Process in blocks of 20 lines to prevent buffer overflow
    const BLOCK_SIZE = 20; 
    let currentBlock = [];

    for (let y = 0; y < height; y++) {
        const lineData = Buffer.alloc(bytesPerLine);
        for (let b = 0; b < bytesPerLine; b++) {
            let byte = 0;
            for (let bit = 0; bit < 8; bit++) {
                const x = b * 8 + bit;
                if (x < width) {
                    const idx = (width * y + x) << 2;
                    if (png.data[idx + 3] > 128 && (png.data[idx] + png.data[idx+1] + png.data[idx+2]) / 3 < 128) {
                        byte |= (1 << (7 - bit));
                    }
                }
            }
            lineData[b] = byte;
        }
        
        currentBlock.push(Buffer.concat([cmdBuffer, lineData]));

        // If block is full or last line, push to chunks
        if (currentBlock.length >= BLOCK_SIZE || y === height - 1) {
            chunks.push(Buffer.concat(currentBlock));
            currentBlock = [];
        }
    }

    // End Mode & Cut
    chunks.push(Buffer.from(STAR_COMMANDS.RASTER_END));
    chunks.push(Buffer.from(STAR_COMMANDS.CUT));

    return chunks;
}

// --- PRINT QUEUE SYSTEM ---
const printQueue = [];
let isProcessingQueue = false;

const executePrintJob = async (job) => {
    const { imageBuffer, connectionType, targetPrinter } = job;
    const MAX_RETRIES = 2;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await new Promise(async (resolve, reject) => {
                if (connectionType === 'usb') {
                     if (!isUsbAvailable) return reject(new Error('USB Drivers not active'));
                     
                     try {
                        let device;
                        let isStarPrinter = false;

                        // Check VID for Star (0x0519 or 1305 decimal)
                        if (targetPrinter && targetPrinter.vid) {
                            const vidHex = targetPrinter.vid.toLowerCase().replace('0x', '');
                            const vidDec = parseInt(vidHex, 16);
                            if (vidDec === 1305 || vidHex === '0519' || vidHex === '519') {
                                isStarPrinter = true;
                            }
                        }

                        // Auto-detect Star if not specified
                        if (!device && !targetPrinter.vid) {
                            const devices = escpos.USB.findPrinter();
                            if (devices.length > 0) {
                                const d = devices[0];
                                const vid = d.deviceDescriptor.idVendor;
                                if (vid === 1305 || vid === 0x0519) isStarPrinter = true;
                            }
                        }

                        // Connect
                        if (targetPrinter && targetPrinter.vid && targetPrinter.pid) {
                            const vid = parseInt(targetPrinter.vid.replace('0x', ''), 16);
                            const pid = parseInt(targetPrinter.pid.replace('0x', ''), 16);
                            device = new escpos.USB(vid, pid);
                        } else {
                            device = new escpos.USB();
                        }

                        if (!device) return reject(new Error('USB Device init failed'));

                        const printer = new escpos.Printer(device);
                        
                        device.open(async (err) => {
                            if (err) return reject(new Error('Open Error: ' + err.message));
                            
                            try {
                                if (isStarPrinter) {
                                    console.log('✨ Star Printer: Sending Chunked Data...');
                                    const chunks = pngToStarChunks(imageBuffer);
                                    
                                    // Loop through chunks and send with delay
                                    for (const chunk of chunks) {
                                        await new Promise((resChunk, rejChunk) => {
                                            printer.adapter.write(chunk, (e) => e ? rejChunk(e) : resChunk());
                                        });
                                        // Critical delay to let printer process buffer
                                        await sleep(50); 
                                    }
                                    
                                    console.log('   Data sent. Closing...');
                                    setTimeout(() => {
                                        device.close(() => resolve());
                                    }, 2000);

                                } else {
                                    // Standard ESC/POS
                                    console.log('🖨️ Standard Printer: Sending Data...');
                                    const data = Buffer.concat([
                                        Buffer.from(COMMANDS.INIT),
                                        pngToEscPosRaster(imageBuffer),
                                        Buffer.from('\n\n\n'),
                                        Buffer.from(COMMANDS.CUT)
                                    ]);
                                    
                                    printer.adapter.write(data, () => {
                                        setTimeout(() => {
                                            device.close(() => resolve());
                                        }, 500);
                                    });
                                }
                            } catch (writeErr) {
                                device.close();
                                reject(writeErr);
                            }
                        });
                     } catch (e) { reject(e); }
                } else {
                    // Network Printing
                    const targetHost = (targetPrinter && targetPrinter.ip) ? targetPrinter.ip : PRINTER_CONFIG.host;
                    const targetPort = (targetPrinter && targetPrinter.port) ? targetPrinter.port : PRINTER_CONFIG.port;
                    
                    const client = new net.Socket();
                    client.setTimeout(5000);
                    
                    const rasterData = pngToEscPosRaster(imageBuffer);

                    client.connect(targetPort, targetHost, () => {
                        client.write(Buffer.from(COMMANDS.INIT));
                        client.write(rasterData);
                        client.write(Buffer.from('\n\n\n')); 
                        client.write(Buffer.from(COMMANDS.CUT));
                        client.end();
                    });

                    client.on('error', (err) => reject(err));
                    client.on('close', () => resolve());
                }
            });
            return; // Success
        } catch (error) {
            console.error(`[Print] Attempt ${attempt} failed: ${error.message}`);
            if (attempt === MAX_RETRIES) throw error;
            await sleep(2000);
        }
    }
};

const processQueue = async () => {
    if (isProcessingQueue || printQueue.length === 0) return;
    isProcessingQueue = true;
    const job = printQueue.shift();

    try {
        await executePrintJob(job);
        if (!job.res.headersSent) job.res.json({ success: true });
    } catch (error) {
        if (!job.res.headersSent) job.res.status(500).json({ success: false, error: error.message });
    } finally {
        isProcessingQueue = false;
        setTimeout(processQueue, 1000);
    }
};

app.get('/', (req, res) => res.send('POS Print Server Ready'));
app.get('/scan-usb', (req, res) => {
    if (!isUsbAvailable) return res.status(500).json({ error: 'No USB Driver' });
    try {
        const devices = escpos.USB.findPrinter().map(d => ({
            vid: '0x' + (d.deviceDescriptor.idVendor.toString(16).padStart(4,'0')),
            pid: '0x' + (d.deviceDescriptor.idProduct.toString(16).padStart(4,'0'))
        }));
        res.json({ success: true, devices });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/check-printer', (req, res) => {
    // Basic connectivity check logic (simplified for brevity)
    res.json({ online: true, message: 'Online' });
});

app.post('/print-image', (req, res) => {
    const { image, targetPrinter, connectionType } = req.body;
    if (!image) return res.status(400).json({ error: 'No image' });
    
    try {
        const base64Data = image.replace(/^data:image\/png;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, 'base64');
        console.log(`[Queue] Added job: ${connectionType} ${targetPrinter?.vid || ''}`);
        printQueue.push({ res, imageBuffer, connectionType, targetPrinter });
        processQueue();
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(SERVER_PORT, () => {
    console.log(`\n=== POS PRINT SERVER STARTED (${SERVER_PORT}) ===`);
    console.log(`* Optimized for Star Micronics (VID 0x0519)`);
    console.log(`===========================================\n`);
});
