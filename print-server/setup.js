
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const configPath = path.join(__dirname, 'config.json');

// ค่าเริ่มต้นเผื่อหาไฟล์ไม่เจอ
let config = {
    host: '192.168.1.200',
    port: 9100,
    width: 42
};

// 1. โหลดค่าเดิมถ้ามี
if (fs.existsSync(configPath)) {
    try {
        const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        config = { ...config, ...savedConfig };
    } catch (e) {
        console.error("Error reading config file, using defaults.");
    }
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('\n=============================================');
console.log('      POS PRINT SERVER CONFIGURATION');
console.log('=============================================');
console.log(`\n[ Current Printer IP ]: ${config.host}`);
console.log(`[ Current Port       ]: ${config.port}`);
console.log('---------------------------------------------');

rl.question('\nEnter new IP Address (or press ENTER to use current): ', (answer) => {
    const newIP = answer.trim();

    if (newIP) {
        config.host = newIP;
        // บันทึกค่าใหม่ลงไฟล์
        try {
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            console.log(`\n[OK] Updated Printer IP to: ${config.host}`);
            console.log('[OK] Configuration saved automatically.');
        } catch (e) {
            console.error('\n[Error] Could not save configuration:', e.message);
        }
    } else {
        console.log(`\n[OK] Using existing IP: ${config.host}`);
    }

    console.log('\nStarting Server...');
    console.log('=============================================\n');
    rl.close();
    
    // หลังจากตั้งค่าเสร็จ ให้จบการทำงานของ setup.js เพื่อให้ .bat ไปรัน server.js ต่อ
});
