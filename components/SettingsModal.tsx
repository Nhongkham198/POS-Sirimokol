
import React, { useState, useEffect, useRef } from 'react';
import type { PrinterConfig, ReceiptPrintSettings, KitchenPrinterSettings, CashierPrinterSettings, MenuItem, DeliveryProvider, PrinterStatus, PrinterConnectionType } from '../types';
import { printerService } from '../services/printerService';
import Swal from 'sweetalert2';
import { MenuItemImage } from './MenuItemImage';
import { db } from '../firebaseConfig';
import { DEFAULT_MENU_ITEMS, DEFAULT_TABLES, DEFAULT_USERS, DEFAULT_BRANCHES, DEFAULT_STOCK_ITEMS, DEFAULT_MAINTENANCE_ITEMS } from '../constants';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (
        logoUrl: string | null,
        appLogoUrl: string | null,
        qrCodeUrl: string | null,
        notificationSoundUrl: string | null,
        staffCallSoundUrl: string | null,
        printerConfig: PrinterConfig | null,
        openingTime: string | null,
        closingTime: string | null,
        restaurantAddress: string,
        restaurantPhone: string,
        taxId: string,
        signatureUrl: string | null
    ) => void;
    currentLogoUrl: string | null;
    currentAppLogoUrl: string | null;
    currentQrCodeUrl: string | null;
    currentNotificationSoundUrl: string | null;
    currentStaffCallSoundUrl: string | null;
    currentPrinterConfig: PrinterConfig | null;
    currentOpeningTime: string | null;
    currentClosingTime: string | null;
    onSavePrinterConfig: (config: PrinterConfig | null) => void;
    menuItems: MenuItem[];
    currentRecommendedMenuItemIds: number[];
    onSaveRecommendedItems: (ids: number[]) => void;
    deliveryProviders: DeliveryProvider[];
    onSaveDeliveryProviders: (providers: DeliveryProvider[]) => void;
    currentRestaurantAddress: string;
    currentRestaurantPhone: string;
    currentTaxId: string;
    currentSignatureUrl: string | null;
}

const DEFAULT_RECEIPT_OPTIONS: ReceiptPrintSettings = {
    showLogo: true,
    showRestaurantName: true,
    showAddress: true,
    address: '',
    showPhoneNumber: true,
    phoneNumber: '',
    showTable: true,
    showStaff: true,
    showDateTime: true,
    showOrderId: true,
    showItems: true,
    showSubtotal: true,
    showTax: true,
    showTotal: true,
    showPaymentMethod: true,
    showThankYouMessage: true,
    thankYouMessage: 'ขอบคุณที่ใช้บริการ',
    showQrCode: true,
};

// --- Helper: Compress Image to prevent Firestore limit errors ---
const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Limit width to 300px for general assets
                const maxWidth = 300; 
                const scaleSize = maxWidth / img.width;
                const width = (img.width > maxWidth) ? maxWidth : img.width;
                const height = (img.width > maxWidth) ? img.height * scaleSize : img.height;

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    // Compress to JPEG, quality 0.7
                    const base64 = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(base64);
                } else {
                    reject(new Error('Canvas context not found'));
                }
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};

const StatusIndicator: React.FC<{ status: PrinterStatus; label: string }> = ({ status, label }) => {
    let color = 'bg-gray-400';
    let text = 'ไม่ได้ตรวจสอบ';
    if (status === 'checking') { color = 'bg-yellow-500 animate-pulse'; text = 'กำลังตรวจสอบ...'; }
    else if (status === 'success') { color = 'bg-green-500'; text = 'เชื่อมต่อได้'; }
    else if (status === 'error') { color = 'bg-red-500'; text = 'เชื่อมต่อไม่ได้'; }

    return (
        <div className="flex items-center gap-2 text-sm">
            <div className={`w-3 h-3 rounded-full ${color}`}></div>
            <span className="text-gray-600">{label}: {text}</span>
        </div>
    );
};

export const SettingsModal: React.FC<SettingsModalProps> = (props) => {
    const [activeTab, setActiveTab] = useState<'general' | 'printer' | 'menu' | 'delivery' | 'database'>('general');
    
    // State initialization
    const [settingsForm, setSettingsForm] = useState({
        logoUrl: props.currentLogoUrl,
        appLogoUrl: props.currentAppLogoUrl,
        qrCodeUrl: props.currentQrCodeUrl,
        notificationSoundUrl: props.currentNotificationSoundUrl,
        staffCallSoundUrl: props.currentStaffCallSoundUrl,
        printerConfig: props.currentPrinterConfig || { kitchen: null, cashier: null },
        openingTime: props.currentOpeningTime,
        closingTime: props.currentClosingTime,
        restaurantAddress: props.currentRestaurantAddress,
        restaurantPhone: props.currentRestaurantPhone,
        taxId: props.currentTaxId,
        signatureUrl: props.currentSignatureUrl,
    });

    const [printerStatus, setPrinterStatus] = useState<{ kitchen: PrinterStatus; cashier: PrinterStatus }>({
        kitchen: 'idle',
        cashier: 'idle'
    });

    const [tempRecommendedIds, setTempRecommendedIds] = useState<number[]>(props.currentRecommendedMenuItemIds || []);
    const [tempDeliveryProviders, setTempDeliveryProviders] = useState<DeliveryProvider[]>(props.deliveryProviders || []);

    // Refs for file inputs
    const logoInputRef = useRef<HTMLInputElement>(null);
    const appLogoInputRef = useRef<HTMLInputElement>(null);
    const qrInputRef = useRef<HTMLInputElement>(null);
    const signatureInputRef = useRef<HTMLInputElement>(null);
    const soundInputRef = useRef<HTMLInputElement>(null);
    const staffSoundInputRef = useRef<HTMLInputElement>(null);

    // Sync state with props when modal opens
    useEffect(() => {
        if (props.isOpen) {
            setSettingsForm({
                logoUrl: props.currentLogoUrl,
                appLogoUrl: props.currentAppLogoUrl,
                qrCodeUrl: props.currentQrCodeUrl,
                notificationSoundUrl: props.currentNotificationSoundUrl,
                staffCallSoundUrl: props.currentStaffCallSoundUrl,
                printerConfig: props.currentPrinterConfig || { kitchen: null, cashier: null },
                openingTime: props.currentOpeningTime,
                closingTime: props.currentClosingTime,
                restaurantAddress: props.currentRestaurantAddress,
                restaurantPhone: props.currentRestaurantPhone,
                taxId: props.currentTaxId,
                signatureUrl: props.currentSignatureUrl,
            });
            setTempRecommendedIds(props.currentRecommendedMenuItemIds || []);
            setTempDeliveryProviders(props.deliveryProviders || []);
            setPrinterStatus({ kitchen: 'idle', cashier: 'idle' });
        }
    }, [props.isOpen, props.currentLogoUrl, props.currentAppLogoUrl, props.currentQrCodeUrl, props.currentPrinterConfig, props.currentOpeningTime, props.currentClosingTime, props.currentRecommendedMenuItemIds, props.deliveryProviders]);

    const handleInputChange = (field: string, value: any) => {
        setSettingsForm(prev => ({ ...prev, [field]: value }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
        const file = e.target.files?.[0];
        if (file) {
            if (field.includes('Sound')) {
                // Audio files: Read as DataURL (No compression)
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (event.target?.result) {
                        setSettingsForm(prev => ({ ...prev, [field]: event.target?.result as string }));
                    }
                };
                reader.readAsDataURL(file);
            } else {
                // Image files: Compress first
                try {
                    Swal.fire({
                        title: 'กำลังประมวลผลรูปภาพ...',
                        allowOutsideClick: false,
                        didOpen: () => Swal.showLoading()
                    });
                    
                    const base64 = await compressImage(file);
                    
                    if (base64.length > 800000) {
                        Swal.fire('ไฟล์ใหญ่เกินไป', 'รูปภาพยังคงมีขนาดใหญ่เกินไป กรุณาใช้รูปที่เล็กกว่านี้', 'error');
                        return;
                    }

                    setSettingsForm(prev => ({ ...prev, [field]: base64 }));
                    Swal.close();
                } catch (error) {
                    console.error("Image processing error:", error);
                    Swal.fire('Error', 'ไม่สามารถประมวลผลรูปภาพได้', 'error');
                }
            }
        }
    };

    const handlePrinterChange = (type: 'kitchen' | 'cashier', field: string, value: any) => {
        setSettingsForm(prev => {
            const currentConfig = prev.printerConfig?.[type] || {
                connectionType: 'network',
                ipAddress: '',
                paperWidth: '80mm',
                port: '3000',
                targetPrinterIp: '',
                targetPrinterPort: '9100'
            };
            
            // Handle connection type switch to reset specific fields if needed
            if (field === 'connectionType') {
                if (value === 'usb') {
                    // Initialize USB defaults if switching to USB
                    if (!currentConfig.vid) currentConfig.vid = '';
                    if (!currentConfig.pid) currentConfig.pid = '';
                }
            }

            // Ensure receiptOptions exists for cashier
            if (type === 'cashier' && !('receiptOptions' in currentConfig)) {
                (currentConfig as CashierPrinterSettings).receiptOptions = { ...DEFAULT_RECEIPT_OPTIONS };
            }

            return {
                ...prev,
                printerConfig: {
                    ...prev.printerConfig,
                    [type]: {
                        ...currentConfig,
                        [field]: value
                    }
                }
            };
        });
    };

    const handleReceiptOptionChange = (field: keyof ReceiptPrintSettings, value: any) => {
        setSettingsForm(prev => {
            const currentCashier = prev.printerConfig?.cashier || {
                connectionType: 'network',
                ipAddress: '',
                paperWidth: '80mm',
                receiptOptions: { ...DEFAULT_RECEIPT_OPTIONS }
            } as CashierPrinterSettings;

            return {
                ...prev,
                printerConfig: {
                    ...prev.printerConfig,
                    cashier: {
                        ...currentCashier,
                        receiptOptions: {
                            ...currentCashier.receiptOptions,
                            [field]: value
                        }
                    }
                }
            };
        });
    };

    const handleCheckPrinterStatus = async (type: 'kitchen' | 'cashier') => {
        const config = settingsForm.printerConfig[type];
        if (!config || !config.ipAddress) {
            Swal.fire('ข้อมูลไม่ครบ', 'กรุณาระบุ Print Server IP', 'warning');
            return;
        }

        setPrinterStatus(prev => ({ ...prev, [type]: 'checking' }));
        
        try {
            const result = await printerService.checkPrinterStatus(
                config.ipAddress, 
                config.port || '3000',
                config.targetPrinterIp || '',
                config.targetPrinterPort || '9100',
                config.connectionType,
                config.vid,
                config.pid
            );
            
            setPrinterStatus(prev => ({ ...prev, [type]: result.online ? 'success' : 'error' }));
            
            if (!result.online) {
                Swal.fire('เชื่อมต่อไม่ได้', result.message, 'error');
            }
        } catch (error: any) {
            setPrinterStatus(prev => ({ ...prev, [type]: 'error' }));
            Swal.fire('เกิดข้อผิดพลาด', error.message, 'error');
        }
    };

    const handleScanUsb = async (type: 'kitchen' | 'cashier') => {
        const config = settingsForm.printerConfig[type];
        if (!config || !config.ipAddress) {
            Swal.fire('ข้อมูลไม่ครบ', 'กรุณาระบุ Print Server IP เพื่อสแกน', 'warning');
            return;
        }

        try {
            Swal.fire({ title: 'กำลังสแกน...', didOpen: () => { Swal.showLoading(); } });
            const devices = await printerService.scanUsbDevices(config.ipAddress, config.port || '3000');
            Swal.close();

            if (devices.length === 0) {
                Swal.fire('ไม่พบอุปกรณ์', 'ไม่พบเครื่องพิมพ์ USB ที่เชื่อมต่ออยู่', 'info');
                return;
            }

            const options: Record<string, string> = {};
            devices.forEach((d, idx) => {
                options[`${d.vid}|${d.pid}`] = `Printer ${idx + 1} (VID:${d.vid} PID:${d.pid})`;
            });

            const { value } = await Swal.fire({
                title: 'เลือกอุปกรณ์',
                input: 'select',
                inputOptions: options,
                inputPlaceholder: 'เลือกเครื่องพิมพ์',
                showCancelButton: true,
            });

            if (value) {
                const [vid, pid] = value.split('|');
                handlePrinterChange(type, 'vid', vid);
                handlePrinterChange(type, 'pid', pid);
                Swal.fire('สำเร็จ', `เลือก VID:${vid} PID:${pid} แล้ว`, 'success');
            }

        } catch (error: any) {
            Swal.close();
            Swal.fire('Error', error.message, 'error');
        }
    };

    const handleShowZadigHelp = () => {
        Swal.fire({
            title: 'วิธีแก้ปัญหา USB พิมพ์ไม่ออก (Windows)',
            width: '600px',
            html: `
                <div class="text-left text-sm space-y-4">
                    <div class="bg-red-50 p-3 rounded border border-red-200">
                        <p class="font-bold text-red-600">⚠️ อาการ: กดทดสอบแล้วขึ้น Success แต่เครื่องพิมพ์เงียบ</p>
                        <p class="text-gray-600 mt-1">สาเหตุ: Windows Driver แย่งการทำงาน ทำให้โปรแกรมส่งข้อมูลไปที่เครื่องพิมพ์โดยตรงไม่ได้</p>
                    </div>

                    <div>
                        <h4 class="font-bold text-gray-800 border-b pb-1 mb-2">วิธีแก้ไข (ทำครั้งเดียว):</h4>
                        <ol class="list-decimal pl-5 space-y-2 text-gray-700">
                            <li>
                                <strong>ดาวน์โหลดโปรแกรม Zadig</strong> (ฟรี)
                                <br/><a href="https://zadig.akeo.ie/" target="_blank" class="text-blue-600 underline">คลิกที่นี่เพื่อดาวน์โหลด Zadig</a>
                            </li>
                            <li>เปิดโปรแกรม Zadig ขึ้นมา</li>
                            <li>ไปที่เมนู <strong>Options</strong> > เลือก <strong>List All Devices</strong></li>
                            <li>
                                ในช่องรายการ ให้เลือกชื่อเครื่องพิมพ์ของคุณ
                                <br/><span class="text-xs text-gray-500">(อาจชื่อว่า 'Printer', 'USB Printing Support', หรือชื่อยี่ห้อ)</span>
                            </li>
                            <li>
                                ดูช่องทางขวา (Driver) ให้เลือกเป็น <strong>WinUSB</strong> 
                                <br/><span class="text-xs text-green-600 font-bold">(สำคัญมาก! ต้องเป็น WinUSB เท่านั้น)</span>
                            </li>
                            <li>กดปุ่ม <strong>Replace Driver</strong> หรือ <strong>Install Driver</strong></li>
                            <li>รอจนเสร็จ แล้วกด "ทดสอบพิมพ์" ในหน้านี้ใหม่อีกครั้ง</li>
                        </ol>
                    </div>
                </div>
            `,
            icon: 'info',
            confirmButtonText: 'เข้าใจแล้ว'
        });
    };

    const handleTestPrint = async (type: 'kitchen' | 'cashier') => {
        const printer = settingsForm.printerConfig[type];
        if (!printer) return;
        try {
            await printerService.printTest(
                printer.ipAddress, 
                printer.paperWidth, 
                printer.port || '3000',
                printer.targetPrinterIp,
                printer.targetPrinterPort,
                printer.connectionType,
                printer.vid, 
                printer.pid 
            );
            Swal.fire({ icon: 'success', title: 'ส่งคำสั่งสำเร็จ', text: 'กรุณาตรวจสอบที่เครื่องพิมพ์', timer: 1500, showConfirmButton: false });
        } catch (error: any) {
            Swal.fire({ icon: 'error', title: 'พิมพ์ไม่สำเร็จ', text: error.message });
        }
    };

    const handleSave = () => {
        props.onSave(
            settingsForm.logoUrl,
            settingsForm.appLogoUrl,
            settingsForm.qrCodeUrl,
            settingsForm.notificationSoundUrl,
            settingsForm.staffCallSoundUrl,
            settingsForm.printerConfig,
            settingsForm.openingTime,
            settingsForm.closingTime,
            settingsForm.restaurantAddress,
            settingsForm.restaurantPhone,
            settingsForm.taxId,
            settingsForm.signatureUrl
        );
        props.onSaveRecommendedItems(tempRecommendedIds);
        props.onSaveDeliveryProviders(tempDeliveryProviders);
    };

    const handleRecommendToggle = (itemId: number) => {
        setTempRecommendedIds(prev => {
            if (prev.includes(itemId)) {
                return prev.filter(id => id !== itemId);
            } else {
                if (prev.length >= 10) {
                    Swal.fire('เต็มแล้ว', 'แนะนำเมนูได้สูงสุด 10 รายการ', 'warning');
                    return prev;
                }
                return [...prev, itemId];
            }
        });
    };

    const handleDeliveryToggle = (providerId: string) => {
        setTempDeliveryProviders(prev => prev.map(p => 
            p.id === providerId ? { ...p, isEnabled: !p.isEnabled } : p
        ));
    };

    const handleDeliveryFieldChange = (providerId: string, field: 'iconUrl' | 'color', value: string) => {
        setTempDeliveryProviders(prev => prev.map(p => 
            p.id === providerId ? { ...p, [field]: value } : p
        ));
    };

    // --- DB Initialization Handler ---
    const handleInitializeDb = async () => {
        if (!db) {
            Swal.fire('ข้อผิดพลาด', 'ไม่พบการเชื่อมต่อ Firebase กรุณาตรวจสอบ Config', 'error');
            return;
        }

        const result = await Swal.fire({
            title: 'ยืนยันการเริ่มระบบฐานข้อมูล',
            text: 'ระบบจะตรวจสอบและสร้างข้อมูลเริ่มต้น (เมนู, โต๊ะ, ผู้ใช้) ในฐานข้อมูล หากมีข้อมูลอยู่แล้วจะไม่ถูกเขียนทับ',
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: 'ยืนยัน เริ่มระบบ',
            confirmButtonColor: '#3085d6',
            cancelButtonText: 'ยกเลิก'
        });

        if (result.isConfirmed) {
            try {
                // Show loading with a note about offline mode
                Swal.fire({ 
                    title: 'กำลังตรวจสอบและเขียนข้อมูล...', 
                    text: 'กรุณารอสักครู่ (หากนานเกิน 5 วินาที ระบบจะบันทึกแบบ Offline อัตโนมัติ)',
                    didOpen: () => Swal.showLoading() 
                });
                
                const batch = db.batch();
                
                // Get current branch ID from URL or local storage if possible, otherwise default to 1
                // We'll try to detect the active branch ID from the URL params or selectedBranch in localStorage
                let activeBranchId = '1';
                const urlParams = new URLSearchParams(window.location.search);
                const urlBranch = urlParams.get('branchId');
                
                if (urlBranch) {
                    activeBranchId = urlBranch;
                } else {
                     try {
                        const storedBranch = localStorage.getItem('selectedBranch');
                        if (storedBranch) {
                            const b = JSON.parse(storedBranch);
                            if (b && b.id) activeBranchId = b.id.toString();
                        }
                     } catch(e) {}
                }

                // Helper to set only if not exists or merge safely
                const setIfMissingOrMerge = async (ref: any, defaultData: any) => {
                    const doc = await ref.get();
                    if (!doc.exists) {
                         batch.set(ref, { value: defaultData });
                    } else {
                         // If exists, do nothing or merge? For initial seeding, we prefer not to overwrite existing user data.
                         // But we want to ensure structure exists.
                         // For arrays like menuItems, if empty, we might want to seed.
                         const data = doc.data();
                         if (!data || !data.value || (Array.isArray(data.value) && data.value.length === 0)) {
                              batch.set(ref, { value: defaultData }, { merge: true });
                         }
                    }
                };

                // 1. Global Users (Only set if absolutely missing to avoid resetting passwords)
                await setIfMissingOrMerge(db.doc('users/data'), DEFAULT_USERS);
                
                // 2. Global Branches
                await setIfMissingOrMerge(db.doc('branches/data'), DEFAULT_BRANCHES);
                
                // 3. Current Branch Data
                await setIfMissingOrMerge(db.doc(`branches/${activeBranchId}/menuItems/data`), DEFAULT_MENU_ITEMS);
                await setIfMissingOrMerge(db.doc(`branches/${activeBranchId}/tables/data`), DEFAULT_TABLES);
                await setIfMissingOrMerge(db.doc(`branches/${activeBranchId}/stockItems/data`), DEFAULT_STOCK_ITEMS);
                await setIfMissingOrMerge(db.doc(`branches/${activeBranchId}/maintenanceItems/data`), DEFAULT_MAINTENANCE_ITEMS);
                
                // --- TIMEOUT LOGIC TO PREVENT HANGING ---
                const timeout = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('TIMEOUT')), 5000)
                );

                await Promise.race([batch.commit(), timeout]);
                
                Swal.fire('สำเร็จ', `ตรวจสอบและเริ่มระบบฐานข้อมูล (สาขา ${activeBranchId}) เรียบร้อยแล้ว`, 'success');

            } catch (error: any) {
                if (error.message === 'TIMEOUT') {
                     Swal.fire({
                        icon: 'info',
                        title: 'บันทึกเรียบร้อย (โหมด Offline)',
                        text: 'การเชื่อมต่อฐานข้อมูลใช้เวลานานกว่าปกติ ข้อมูลถูกบันทึกลงเครื่องแล้วและจะซิงค์เมื่ออินเทอร์เน็ตพร้อม',
                        confirmButtonText: 'ตกลง'
                     });
                } else {
                    console.error("Init DB Error:", error);
                    Swal.fire('ล้มเหลว', `เกิดข้อผิดพลาด: ${error.message}`, 'error');
                }
            }
        }
    };

    if (!props.isOpen) return null;

    // ... (Helper render functions: renderImageUpload, renderSoundUpload) ...
    const renderImageUpload = (label: string, value: string | null, field: string, inputRef: React.RefObject<HTMLInputElement>) => (
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
            <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
            <div className="flex gap-4 items-start">
                <div className="w-24 h-24 bg-gray-100 border rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                    {value ? (
                        <img src={value} alt="Preview" className="w-full h-full object-contain" />
                    ) : (
                        <span className="text-xs text-gray-400">ไม่มีรูป</span>
                    )}
                </div>
                <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                        <button onClick={() => inputRef.current?.click()} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded border border-blue-200 hover:bg-blue-100 text-sm font-medium transition-colors">เลือกรูปภาพ</button>
                        {value && (
                            <button onClick={() => handleInputChange(field, null)} className="px-3 py-1.5 bg-red-50 text-red-600 rounded border border-red-200 hover:bg-red-100 text-sm font-medium transition-colors">ลบ</button>
                        )}
                    </div>
                    <input type="text" value={value || ''} onChange={e => handleInputChange(field, e.target.value)} placeholder="หรือใส่ URL ของรูปภาพ..." className="w-full text-xs text-gray-500 border border-gray-300 rounded p-1.5 focus:outline-none focus:border-blue-500" />
                    <input type="file" ref={inputRef} onChange={(e) => handleFileChange(e, field)} className="hidden" accept="image/*" />
                </div>
            </div>
        </div>
    );

    const renderSoundUpload = (label: string, value: string | null, field: string, inputRef: React.RefObject<HTMLInputElement>) => (
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
            <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                    <button onClick={() => inputRef.current?.click()} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded border border-blue-200 hover:bg-blue-100 text-sm font-medium transition-colors">เลือกไฟล์เสียง</button>
                    {value && (
                        <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                            มีไฟล์เสียงแล้ว
                        </span>
                    )}
                </div>
                <input type="file" ref={inputRef} onChange={(e) => handleFileChange(e, field)} className="hidden" accept="audio/*" />
                {value && (
                    <audio controls src={value} className="w-full h-8 mt-1" />
                )}
            </div>
        </div>
    );

    const renderPrinterSettings = (type: 'kitchen' | 'cashier') => {
        const conf = settingsForm.printerConfig[type];
        if (!conf) return (
            <div className="text-center py-4">
                <p className="text-gray-500 mb-2">ยังไม่ได้ตั้งค่าเครื่องพิมพ์ {type === 'kitchen' ? 'ครัว' : 'แคชเชียร์'}</p>
                <button 
                    onClick={() => handlePrinterChange(type, 'connectionType', 'network')} // Initialize
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    ตั้งค่าตอนนี้
                </button>
            </div>
        );

        const receiptOpts = (type === 'cashier' && 'receiptOptions' in conf) ? (conf as CashierPrinterSettings).receiptOptions : undefined;
        
        return (
            <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">ประเภทการเชื่อมต่อ</label>
                        <div className="flex gap-4">
                            <button type="button" onClick={() => handlePrinterChange(type, 'connectionType', 'network')} className={`flex-1 py-2 rounded-md font-bold border-2 transition-all ${conf.connectionType === 'network' ? 'bg-blue-600 text-white border-blue-700 shadow-inner' : 'bg-white text-gray-600 border-gray-300'}`}>WiFi / Network</button>
                            <button type="button" onClick={() => handlePrinterChange(type, 'connectionType', 'usb')} className={`flex-1 py-2 rounded-md font-bold border-2 transition-all ${conf.connectionType === 'usb' ? 'bg-orange-600 text-white border-orange-700 shadow-inner' : 'bg-white text-gray-600 border-gray-300'}`}>USB (ต่อตรง)</button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">ขนาดหน้ากว้างกระดาษ</label>
                        <div className="flex gap-4">
                            <label className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-md border-2 cursor-pointer transition-all ${conf.paperWidth === '80mm' ? 'border-blue-600 bg-blue-50 text-blue-800 font-bold' : 'border-gray-200 bg-white text-gray-600'}`}>
                                <input
                                    type="radio"
                                    name={`paperWidth-${type}`}
                                    value="80mm"
                                    checked={conf.paperWidth === '80mm'}
                                    onChange={() => handlePrinterChange(type, 'paperWidth', '80mm')}
                                    className="hidden"
                                />
                                <span>80mm (มาตรฐาน)</span>
                            </label>
                            <label className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-md border-2 cursor-pointer transition-all ${conf.paperWidth === '58mm' ? 'border-blue-600 bg-blue-50 text-blue-800 font-bold' : 'border-gray-200 bg-white text-gray-600'}`}>
                                <input
                                    type="radio"
                                    name={`paperWidth-${type}`}
                                    value="58mm"
                                    checked={conf.paperWidth === '58mm'}
                                    onChange={() => handlePrinterChange(type, 'paperWidth', '58mm')}
                                    className="hidden"
                                />
                                <span>58mm (เล็ก)</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-8 md:col-span-9">
                        <label className="block text-sm font-bold text-blue-700">Print Server IP (เครื่องที่รัน Node.js)</label>
                        <input type="text" value={conf.ipAddress} onChange={(e) => handlePrinterChange(type, 'ipAddress', e.target.value)} placeholder="เช่น 192.168.1.13" className="mt-1 block w-full border border-gray-300 p-2 rounded-md shadow-sm text-gray-900" />
                    </div>
                    <div className="col-span-4 md:col-span-3">
                        <label className="block text-sm font-bold text-blue-700">Port</label>
                        <input type="text" value={conf.port} onChange={(e) => handlePrinterChange(type, 'port', e.target.value)} placeholder="3000" className="mt-1 block w-full border border-gray-300 p-2 rounded-md shadow-sm text-gray-900" />
                    </div>
                    {conf.connectionType === 'network' && (
                        <div className="col-span-12">
                            <label className="block text-sm font-bold text-green-700">Printer IP (ตัวเครื่องพิมพ์)</label>
                            <input type="text" value={conf.targetPrinterIp || ''} onChange={(e) => handlePrinterChange(type, 'targetPrinterIp', e.target.value)} placeholder="เช่น 192.168.1.200" className="mt-1 block w-full border border-gray-300 p-2 rounded-md shadow-sm text-gray-900" />
                        </div>
                    )}
                    {conf.connectionType === 'usb' && (
                        <div className="col-span-12 bg-orange-50 p-3 rounded-lg border border-orange-200">
                            <div className="flex justify-between items-center mb-3 border-b border-orange-200 pb-2">
                                <label className="block text-sm font-bold text-orange-900">การตั้งค่า USB</label>
                                <button onClick={handleShowZadigHelp} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded shadow-sm flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    คู่มือแก้ปัญหา & ดาวน์โหลด Zadig
                                </button>
                            </div>
                            
                            <p className="text-xs text-gray-700 mb-2 font-medium">ระบุอุปกรณ์ USB (Optional - หากมีหลายเครื่อง)</p>
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <label className="text-xs text-orange-700 block">Vendor ID (VID)</label>
                                    <input type="text" value={conf.vid || ''} onChange={(e) => handlePrinterChange(type, 'vid', e.target.value)} placeholder="0x...." className="mt-1 w-full border border-gray-300 p-2 rounded-md" />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs text-orange-700 block">Product ID (PID)</label>
                                    <input type="text" value={conf.pid || ''} onChange={(e) => handlePrinterChange(type, 'pid', e.target.value)} placeholder="0x...." className="mt-1 w-full border border-gray-300 p-2 rounded-md" />
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => handleScanUsb(type)} 
                                    className="px-4 py-2 bg-orange-600 text-white font-bold rounded-md hover:bg-orange-700 h-10 shadow-sm whitespace-nowrap"
                                >
                                    🔍 สแกนหาอุปกรณ์
                                </button>
                            </div>
                            <div className="mt-3 bg-white p-2 rounded border border-orange-100 text-xs text-gray-600">
                                <p>* หากไม่ระบุ VID/PID ระบบจะพิมพ์ออกเครื่อง USB ตัวแรกที่เจอ</p>
                                <p className="text-red-500 font-bold mt-1">
                                    ** สำคัญ: หากกดทดสอบแล้วขึ้น Success แต่เครื่องไม่พิมพ์ ต้องทำ Zadig (กดปุ่มคู่มือด้านบน)
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {type === 'cashier' && receiptOpts && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                        {/* ... (Receipt options rendering) ... */}
                        <h4 className="text-lg font-bold text-gray-800 mb-4">รายละเอียดบนใบเสร็จ</h4>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    {Object.keys(DEFAULT_RECEIPT_OPTIONS).map(key => {
                                        if (typeof DEFAULT_RECEIPT_OPTIONS[key as keyof ReceiptPrintSettings] === 'boolean') {
                                            const labelMap: Record<string, string> = {
                                                showLogo: 'โลโก้ร้าน', showRestaurantName: 'ชื่อร้าน', showAddress: 'ที่อยู่',
                                                showPhoneNumber: 'เบอร์โทร', showTable: 'โต๊ะ', showStaff: 'พนักงาน',
                                                showDateTime: 'วัน/เวลา', showOrderId: 'เลขที่ออเดอร์', showItems: 'รายการอาหาร',
                                                showSubtotal: 'ยอดรวม', showTax: 'ภาษี', showTotal: 'ยอดสุทธิ',
                                                showPaymentMethod: 'การชำระเงิน', showThankYouMessage: 'ข้อความขอบคุณ',
                                                showQrCode: 'QR Code รับเงิน'
                                            };
                                            return (
                                                <label key={key} className="flex items-center gap-2 cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={!!receiptOpts[key as keyof ReceiptPrintSettings]} 
                                                        onChange={(e) => handleReceiptOptionChange(key as keyof ReceiptPrintSettings, e.target.checked)} 
                                                        className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                                                    />
                                                    <span className="text-sm font-medium text-gray-700">{labelMap[key] || key}</span>
                                                </label>
                                            );
                                        }
                                        return null;
                                    })}
                                </div>
                                <div className="space-y-3 pt-4 border-t border-gray-200">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">ที่อยู่ร้าน (บนใบเสร็จ)</label>
                                        <textarea value={receiptOpts.address} onChange={(e) => handleReceiptOptionChange('address', e.target.value)} rows={2} className="w-full text-sm border-gray-300 rounded-md shadow-sm p-2" placeholder="ที่อยู่..." />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">เบอร์โทรศัพท์</label>
                                        <input type="text" value={receiptOpts.phoneNumber} onChange={(e) => handleReceiptOptionChange('phoneNumber', e.target.value)} className="w-full text-sm border-gray-300 rounded-md shadow-sm p-2" placeholder="02-xxx-xxxx" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">ข้อความขอบคุณ</label>
                                        <input type="text" value={receiptOpts.thankYouMessage} onChange={(e) => handleReceiptOptionChange('thankYouMessage', e.target.value)} className="w-full text-sm border-gray-300 rounded-md shadow-sm p-2" placeholder="ขอบคุณที่ใช้บริการ" />
                                    </div>
                                </div>
                            </div>
                            
                            {/* Preview */}
                            <div className="bg-gray-200 p-4 rounded-xl flex items-center justify-center min-h-[400px]">
                                <div className="bg-white shadow-lg w-[280px] p-4 text-black font-mono text-xs leading-snug flex flex-col items-center">
                                    {receiptOpts.showLogo && settingsForm.logoUrl && <img src={settingsForm.logoUrl} alt="Logo" className="h-12 w-auto object-contain mb-2" crossOrigin="anonymous" />}
                                    {receiptOpts.showRestaurantName && <div className="font-bold text-base mb-1">ร้านอาหารตัวอย่าง</div>}
                                    {receiptOpts.showAddress && <div className="text-center whitespace-pre-wrap mb-1">{receiptOpts.address || settingsForm.restaurantAddress}</div>}
                                    {receiptOpts.showPhoneNumber && <div className="text-center mb-2">Tel: {receiptOpts.phoneNumber || settingsForm.restaurantPhone}</div>}
                                    
                                    <div className="w-full border-b border-dashed border-gray-400 my-2"></div>
                                    <div style={{fontSize: '14px', fontWeight: 'bold', textAlign: 'center', marginBottom: '10px'}}>ใบเสร็จรับเงิน</div>

                                    <div className="w-full text-left space-y-0.5 mb-2">
                                        {receiptOpts.showTable && <div>โต๊ะ: 5</div>}
                                        {receiptOpts.showOrderId && <div>Order: #001</div>}
                                        {receiptOpts.showDateTime && <div>วันที่: {new Date().toLocaleDateString('th-TH')} {new Date().toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}</div>}
                                        {receiptOpts.showStaff && <div>พนักงาน: Admin</div>}
                                    </div>

                                    {receiptOpts.showItems && (
                                        <>
                                            <div className="w-full border-b border-dashed border-gray-400 mb-2"></div>
                                            <div className="w-full space-y-1 mb-2">
                                                <div className="flex justify-between"><span>1. ข้าวกะเพรา</span><span>60.00</span></div>
                                                <div className="flex justify-between"><span>2. น้ำเปล่า</span><span>15.00</span></div>
                                            </div>
                                        </>
                                    )}

                                    <div className="w-full border-b border-dashed border-gray-400 my-2"></div>
                                    <div className="w-full space-y-1">
                                        {receiptOpts.showSubtotal && <div className="flex justify-between"><span>รวมเงิน</span><span>75.00</span></div>}
                                        {receiptOpts.showTax && <div className="flex justify-between"><span>ภาษี (7%)</span><span>5.25</span></div>}
                                        {receiptOpts.showTotal && <div className="flex justify-between font-bold text-sm mt-1"><span>ยอดสุทธิ</span><span>80.25</span></div>}
                                        {receiptOpts.showPaymentMethod && <div className="text-center mt-2">(ชำระโดย: เงินสด)</div>}
                                    </div>
                                    {receiptOpts.showThankYouMessage && <div className="mt-4 text-center font-bold">*** {receiptOpts.thankYouMessage} ***</div>}
                                    {receiptOpts.showQrCode && settingsForm.qrCodeUrl && (
                                        <div className="mt-4 text-center border-t border-dashed border-gray-400 pt-3">
                                            <div className="font-bold text-sm mb-1">สแกนเพื่อชำระเงิน</div>
                                            <img src={settingsForm.qrCodeUrl} alt="QR Code" className="h-24 w-auto object-contain mx-auto" crossOrigin="anonymous"/>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200 mt-4">
                    <StatusIndicator status={printerStatus[type]} label="สถานะ" />
                    <button type="button" onClick={() => handleCheckPrinterStatus(type)} className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700">ตรวจสอบสถานะ</button>
                    <button type="button" onClick={() => handleTestPrint(type)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50">ทดสอบพิมพ์</button>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl flex flex-col h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <h2 className="text-xl font-bold text-gray-800">ตั้งค่าระบบ</h2>
                    <button onClick={props.onClose} className="text-gray-500 hover:text-gray-700">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex border-b bg-white overflow-x-auto">
                    {['general', 'printer', 'menu', 'delivery', 'database'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 whitespace-nowrap ${
                                activeTab === tab ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {tab === 'general' && 'ทั่วไป'}
                            {tab === 'printer' && 'เครื่องพิมพ์'}
                            {tab === 'menu' && 'เมนูแนะนำ'}
                            {tab === 'delivery' && 'Delivery'}
                            {tab === 'database' && 'ฐานข้อมูล'}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                    {/* ... (Existing Tabs: general, printer, menu, delivery) ... */}
                    {activeTab === 'general' && (
                        <div className="space-y-6 max-w-3xl mx-auto">
                            <div className="bg-white p-6 rounded-lg shadow-sm space-y-4">
                                <h3 className="text-lg font-bold text-gray-800 border-b pb-2">ข้อมูลร้าน</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">ชื่อร้าน</label>
                                        <input 
                                            type="text" 
                                            value={settingsForm.logoUrl ? 'ใช้โลโก้แทน' : '(แก้ไขที่ Header)'} 
                                            disabled 
                                            className="mt-1 block w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm p-2 text-gray-500" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">เบอร์โทรศัพท์</label>
                                        <input 
                                            type="text" 
                                            value={settingsForm.restaurantPhone} 
                                            onChange={e => handleInputChange('restaurantPhone', e.target.value)} 
                                            className="mt-1 block w-full bg-gray-50 border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" 
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700">ที่อยู่</label>
                                        <textarea 
                                            value={settingsForm.restaurantAddress} 
                                            onChange={e => handleInputChange('restaurantAddress', e.target.value)} 
                                            rows={3} 
                                            className="mt-1 block w-full bg-gray-50 border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">เลขประจำตัวผู้เสียภาษี</label>
                                        <input 
                                            type="text" 
                                            value={settingsForm.taxId} 
                                            onChange={e => handleInputChange('taxId', e.target.value)} 
                                            className="mt-1 block w-full bg-gray-50 border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" 
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-lg shadow-sm space-y-4">
                                <h3 className="text-lg font-bold text-gray-800 border-b pb-2">รูปภาพและเสียง</h3>
                                <div className="space-y-4">
                                    {renderImageUpload("โลโก้ร้าน (สำหรับใบเสร็จ)", settingsForm.logoUrl, 'logoUrl', logoInputRef)}
                                    {renderImageUpload("App Logo (สำหรับหน้า Login/Admin)", settingsForm.appLogoUrl, 'appLogoUrl', appLogoInputRef)}
                                    {renderImageUpload("QR Code จ่ายเงิน", settingsForm.qrCodeUrl, 'qrCodeUrl', qrInputRef)}
                                    {renderImageUpload("ลายเซ็น (สำหรับใบเสร็จ)", settingsForm.signatureUrl, 'signatureUrl', signatureInputRef)}
                                    
                                    {renderSoundUpload("เสียงแจ้งเตือนออเดอร์ใหม่", settingsForm.notificationSoundUrl, 'notificationSoundUrl', soundInputRef)}
                                    {renderSoundUpload("เสียงแจ้งเตือนเรียกพนักงาน", settingsForm.staffCallSoundUrl, 'staffCallSoundUrl', staffSoundInputRef)}
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-lg shadow-sm space-y-4">
                                <h3 className="text-lg font-bold text-gray-800 border-b pb-2">เวลาทำการ</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">เวลาเปิด</label>
                                        <input type="time" value={settingsForm.openingTime || '10:00'} onChange={e => handleInputChange('openingTime', e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">เวลาปิด</label>
                                        <input type="time" value={settingsForm.closingTime || '22:00'} onChange={e => handleInputChange('closingTime', e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'printer' && (
                        <div className="space-y-6 max-w-4xl mx-auto">
                            <div className="bg-white p-6 rounded-lg shadow-sm">
                                <h3 className="text-xl font-bold text-gray-800 border-b pb-4 mb-4 flex items-center gap-2">
                                    <span className="text-2xl">🍳</span> เครื่องพิมพ์ครัว (Kitchen)
                                </h3>
                                {renderPrinterSettings('kitchen')}
                            </div>
                            <div className="bg-white p-6 rounded-lg shadow-sm">
                                <h3 className="text-xl font-bold text-gray-800 border-b pb-4 mb-4 flex items-center gap-2">
                                    <span className="text-2xl">🧾</span> เครื่องพิมพ์ใบเสร็จ (Cashier)
                                </h3>
                                {renderPrinterSettings('cashier')}
                            </div>
                        </div>
                    )}

                    {activeTab === 'menu' && (
                        <div className="bg-white p-6 rounded-lg shadow-sm max-w-4xl mx-auto">
                            <h3 className="text-lg font-bold text-gray-800 mb-4">เลือกเมนูแนะนำ (สูงสุด 10 รายการ)</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {props.menuItems.map(item => {
                                    const isSelected = tempRecommendedIds.includes(item.id);
                                    return (
                                        <div 
                                            key={item.id} 
                                            onClick={() => handleRecommendToggle(item.id)}
                                            className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${isSelected ? 'border-green-500 shadow-md transform scale-105' : 'border-gray-200 hover:border-blue-300'}`}
                                        >
                                            <div className="aspect-square bg-gray-100">
                                                <MenuItemImage src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                            </div>
                                            <div className={`p-2 text-xs font-semibold text-center truncate ${isSelected ? 'bg-green-50 text-green-700' : 'bg-white text-gray-700'}`}>
                                                {item.name}
                                            </div>
                                            {isSelected && (
                                                <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full p-0.5">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {activeTab === 'delivery' && (
                        <div className="bg-white p-6 rounded-lg shadow-sm max-w-3xl mx-auto">
                            <h3 className="text-lg font-bold text-gray-800 mb-4">จัดการ Delivery Providers</h3>
                            <div className="space-y-4">
                                {tempDeliveryProviders.map(provider => (
                                    <div key={provider.id} className="p-4 border rounded-lg bg-gray-50 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div 
                                                    className="w-10 h-10 rounded-md flex items-center justify-center overflow-hidden flex-shrink-0"
                                                    style={{ backgroundColor: provider.color || '#e5e7eb' }}
                                                >
                                                    {provider.iconUrl ? (
                                                        <img src={provider.iconUrl} alt={provider.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-white font-bold text-lg">{provider.name.charAt(0)}</span>
                                                    )}
                                                </div>
                                                <span className="font-bold text-gray-800 text-lg">{provider.name}</span>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={provider.isEnabled} 
                                                    onChange={() => handleDeliveryToggle(provider.id)} 
                                                    className="sr-only peer" 
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                            </label>
                                        </div>
                                        
                                        {/* Edit Fields */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-200">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1">URL รูปไอคอน</label>
                                                <input 
                                                    type="text" 
                                                    value={provider.iconUrl || ''} 
                                                    onChange={(e) => handleDeliveryFieldChange(provider.id, 'iconUrl', e.target.value)}
                                                    placeholder="https://..."
                                                    className="w-full text-sm border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1">สีประจำค่าย</label>
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="color" 
                                                        value={provider.color || '#000000'} 
                                                        onChange={(e) => handleDeliveryFieldChange(provider.id, 'color', e.target.value)}
                                                        className="h-9 w-12 border border-gray-300 rounded cursor-pointer p-0.5 bg-white"
                                                    />
                                                    <input 
                                                        type="text" 
                                                        value={provider.color || ''} 
                                                        onChange={(e) => handleDeliveryFieldChange(provider.id, 'color', e.target.value)}
                                                        placeholder="#RRGGBB"
                                                        className="flex-1 text-sm border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* NEW: Database Maintenance Tab */}
                    {activeTab === 'database' && (
                        <div className="bg-white p-6 rounded-lg shadow-sm max-w-3xl mx-auto space-y-6">
                            <div className="border-l-4 border-yellow-400 bg-yellow-50 p-4 rounded">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-yellow-800">เครื่องมือสำหรับ Admin</h3>
                                        <div className="mt-2 text-sm text-yellow-700">
                                            <p>ใช้สำหรับเริ่มระบบใหม่ หรือแก้ปัญหาข้อมูลไม่ซิงค์กัน</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border border-gray-200 rounded-lg">
                                <h4 className="text-lg font-bold text-gray-900 mb-2">เริ่มระบบฐานข้อมูล (Initialize DB)</h4>
                                <p className="text-gray-600 mb-4 text-sm">
                                    หากคุณเพิ่ง Deploy ระบบใหม่ หรือพบปัญหาข้อมูลว่างเปล่า (เช่น เมนูไม่ขึ้น ผู้ใช้หาย) 
                                    ปุ่มนี้จะทำการเขียนข้อมูลเริ่มต้น (Default Data) ลงไปยัง Firebase Firestore
                                </p>
                                <button 
                                    onClick={handleInitializeDb}
                                    className="w-full sm:w-auto px-6 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow-md transition-colors flex items-center justify-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                                    </svg>
                                    เขียนข้อมูลเริ่มต้นทับ (Reset)
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-lg">
                    <button onClick={props.onClose} className="px-6 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300">ยกเลิก</button>
                    <button onClick={handleSave} className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 shadow-md">บันทึกทั้งหมด</button>
                </div>
            </div>
        </div>
    );
};
