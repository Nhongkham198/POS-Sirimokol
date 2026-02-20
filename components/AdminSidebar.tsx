
import React, { useState, ReactNode, useRef, useMemo, useEffect } from 'react';
import type { User, View, PrinterConfig, PrinterStatus } from '../types';
import Swal from 'sweetalert2';
import { printerService } from '../services/printerService';
import { db } from '../firebaseConfig'; // Import db to check status

interface AdminSidebarProps {
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    logoUrl: string | null;
    restaurantName: string;
    branchName: string;
    currentUser: User;
    onViewChange: (view: View) => void;
    currentView: View;
    onToggleEditMode: () => void;
    isEditMode: boolean;
    onOpenSettings: () => void;
    onOpenUserManager: () => void;
    onManageBranches: () => void;
    onChangeBranch: () => void;
    onLogout: () => void;
    kitchenBadgeCount: number;
    tablesBadgeCount: number;
    leaveBadgeCount: number;
    stockBadgeCount: number; 
    maintenanceBadgeCount: number; // Added maintenance badge
    onUpdateCurrentUser: (updates: Partial<User>) => void;
    onUpdateLogoUrl: (newUrl: string) => void;
    onUpdateRestaurantName: (newName: string) => void;
    isOrderNotificationsEnabled: boolean;
    onToggleOrderNotifications: () => void;
    printerConfig: PrinterConfig | null; // Added prop
}

// --- Image Compression Helper ---
const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Limit width to 300px for Logo to keep size small (~20-50KB)
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

const NavItem: React.FC<{
    icon: ReactNode;
    text: string;
    isCollapsed: boolean;
    isActive?: boolean;
    onClick?: () => void;
    children?: ReactNode;
    isOpen?: boolean;
    onToggle?: () => void;
    badge?: number;
}> = ({ icon, text, isCollapsed, isActive, onClick, children, isOpen, onToggle, badge }) => {
    const hasChildren = !!children;

    const baseClasses = "flex items-center p-3 my-1 rounded-lg transition-colors duration-200 w-full text-left relative";
    const activeClasses = isActive && !hasChildren ? "bg-green-600 text-white" : "text-gray-300 hover:bg-gray-700 hover:text-white";
    // Modified content render to handle children better
    const content = (
        <>
            <span className="flex-shrink-0 w-6 h-6">{icon}</span>
            <span className={`flex-1 ml-3 whitespace-nowrap transition-opacity duration-200 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>{text}</span>
            {hasChildren && !isCollapsed && (
                <svg className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
            )}
             {badge !== undefined && badge > 0 && (
                 <span className={`absolute top-2 right-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white transition-opacity duration-200 ${isCollapsed ? 'opacity-100' : 'opacity-100'}`}>
                    {badge > 99 ? '99+' : badge}
                </span>
            )}
        </>
    );

    return (
        <li>
            {hasChildren ? (
                <button onClick={onToggle} className={`${baseClasses} ${activeClasses} ${isOpen ? 'bg-gray-700 text-white' : ''}`}>
                    {content}
                </button>
            ) : (
                <a href="#" onClick={(e) => { e.preventDefault(); onClick?.(); }} className={`${baseClasses} ${activeClasses}`}>
                    {content}
                </a>
            )}
            {hasChildren && isOpen && !isCollapsed && (
                <ul className="pl-2 py-1 space-y-1 bg-gray-900/50 rounded-b-lg">
                    {children}
                </ul>
            )}
        </li>
    );
};

const SubNavItem: React.FC<{
    text: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ text, isActive, onClick }) => (
    <li>
        <a 
            href="#" 
            onClick={(e) => { e.preventDefault(); onClick(); }}
            className={`flex items-center p-2 pl-11 w-full text-sm font-medium rounded-lg transition-colors ${
                isActive ? 'bg-green-600/80 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
        >
            {text}
        </a>
    </li>
);

// Small status indicator for Sidebar
const SidebarPrinterStatus: React.FC<{
    type: 'kitchen' | 'cashier';
    status: PrinterStatus;
    onClick: () => void;
    isCollapsed: boolean;
}> = ({ type, status, onClick, isCollapsed }) => {
    const icon = type === 'kitchen' ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
    ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
    );

    const color = status === 'success' ? 'bg-green-500' : status === 'error' ? 'bg-red-500' : status === 'checking' ? 'bg-yellow-500' : 'bg-gray-500';
    const label = type === 'kitchen' ? 'ครัว' : 'แคชเชียร์';

    return (
        <button 
            onClick={onClick}
            className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-700 w-full transition-colors text-gray-400 hover:text-white"
            title={`คลิกเพื่อตรวจสอบสถานะ: ${label}`}
        >
            <div className={`w-2 h-2 rounded-full ${color} ${status === 'checking' ? 'animate-pulse' : ''}`}></div>
            {icon}
            {!isCollapsed && <span className="text-xs font-medium">{label}</span>}
        </button>
    );
};


const AdminSidebar: React.FC<AdminSidebarProps> = ({
    isCollapsed,
    onToggleCollapse,
    logoUrl,
    restaurantName,
    branchName,
    currentUser,
    onViewChange,
    currentView,
    onToggleEditMode,
    isEditMode,
    onOpenSettings,
    onOpenUserManager,
    onManageBranches,
    onChangeBranch,
    onLogout,
    kitchenBadgeCount,
    tablesBadgeCount,
    leaveBadgeCount,
    stockBadgeCount,
    maintenanceBadgeCount,
    onUpdateCurrentUser,
    onUpdateLogoUrl,
    onUpdateRestaurantName,
    isOrderNotificationsEnabled,
    onToggleOrderNotifications,
    printerConfig
}) => {
    const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
      'stock': true,
      'leave': false
    });
    const logoInputRef = useRef<HTMLInputElement>(null);
    const profileInputRef = useRef<HTMLInputElement>(null);

    // Printer Status
    const [kitchenStatus, setKitchenStatus] = useState<PrinterStatus>('idle');
    const [cashierStatus, setCashierStatus] = useState<PrinterStatus>('idle');
    
    // DB Connection Status
    const [isDbConnected, setIsDbConnected] = useState(false);

    useEffect(() => {
        // Simple check for DB connection by checking if 'db' object exists and is not null
        setIsDbConnected(!!db);
    }, []);

    const checkPrinter = async (type: 'kitchen' | 'cashier') => {
        if (!printerConfig) return;
        const config = printerConfig[type];
        
        if (!config || !config.ipAddress) {
            if (type === 'kitchen') setKitchenStatus('idle');
            else setCashierStatus('idle');
            return;
        }

        if (type === 'kitchen') setKitchenStatus('checking');
        else setCashierStatus('checking');

        try {
            const res = await printerService.checkPrinterStatus(
                config.ipAddress,
                config.port || '3000',
                config.targetPrinterIp || '',
                config.targetPrinterPort || '9100',
                config.connectionType
            );
            
            if (type === 'kitchen') setKitchenStatus(res.online ? 'success' : 'error');
            else setCashierStatus(res.online ? 'success' : 'error');
        } catch (error) {
            if (type === 'kitchen') setKitchenStatus('error');
            else setCashierStatus('error');
        }
    };

    useEffect(() => {
        checkPrinter('kitchen');
        checkPrinter('cashier');
        const interval = setInterval(() => {
            checkPrinter('kitchen');
            checkPrinter('cashier');
        }, 60000);
        return () => clearInterval(interval);
    }, [printerConfig]);


    const roleText = useMemo(() => {
        if (!currentUser) return '';
        switch (currentUser.role) {
            case 'admin': return 'ผู้ดูแลระบบ';
            case 'branch-admin': return 'ผู้ดูแลสาขา';
            case 'pos': return 'พนักงาน POS';
            case 'kitchen': return 'พนักงานครัว';
            case 'auditor': return 'Auditor';
            default: return '';
        }
    }, [currentUser]);

    const toggleMenu = (key: string) => {
        setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleProfilePictureEdit = () => {
        profileInputRef.current?.click();
    };

    const handleProfileFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            try {
                Swal.fire({
                    title: 'กำลังประมวลผลรูปภาพ...',
                    allowOutsideClick: false,
                    didOpen: () => { Swal.showLoading(); }
                });
                
                const base64 = await compressImage(file);
                
                if (base64.length > 800000) { 
                    Swal.fire('ไฟล์ใหญ่เกินไป', 'รูปภาพยังคงมีขนาดใหญ่เกินไป กรุณาใช้รูปที่เล็กกว่านี้', 'error');
                    return;
                }

                onUpdateCurrentUser({ profilePictureUrl: base64 });
                Swal.close();
                Swal.fire({ toast: true, icon: 'success', title: 'อัปเดตโปรไฟล์สำเร็จ', position: 'top-end', showConfirmButton: false, timer: 1500 });

            } catch (error) {
                console.error("Profile upload failed", error);
                Swal.fire('ผิดพลาด', 'ไม่สามารถประมวลผลรูปภาพได้', 'error');
            }
        }
    };
    
    const handleLogoEdit = () => {
        logoInputRef.current?.click();
    };

    const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            try {
                Swal.fire({
                    title: 'กำลังประมวลผลรูปภาพ...',
                    allowOutsideClick: false,
                    didOpen: () => { Swal.showLoading(); }
                });
                
                // Compress image before sending to avoid Firestore 1MB limit
                const base64 = await compressImage(file);
                
                // Check if size is still too large (approx limit for safety)
                if (base64.length > 800000) { // ~800KB
                    Swal.fire('ไฟล์ใหญ่เกินไป', 'รูปภาพยังคงมีขนาดใหญ่เกินไป กรุณาใช้รูปที่เล็กกว่านี้', 'error');
                    return;
                }

                onUpdateLogoUrl(base64);
                Swal.close();
                Swal.fire({ toast: true, icon: 'success', title: 'อัปเดตโลโก้สำเร็จ', position: 'top-end', showConfirmButton: false, timer: 1500 });

            } catch (error) {
                console.error("Logo upload failed", error);
                Swal.fire('ผิดพลาด', 'ไม่สามารถประมวลผลรูปภาพได้', 'error');
            }
        } else if (file) {
            Swal.fire('ผิดพลาด', 'กรุณาเลือกไฟล์รูปภาพเท่านั้น (PNG, JPG, etc.)', 'error');
        }
    };

    const canEdit = currentUser.role === 'admin' || currentUser.role === 'branch-admin';
    const isAuditor = currentUser.role === 'auditor';

    return (
        <aside className={`fixed top-0 left-0 z-40 h-screen bg-gray-800 border-r border-gray-700 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'} hidden md:block`}>
            <div className="flex flex-col h-full">
                {/* Header */}
                 <div className={`flex items-center p-4 border-b border-gray-700 h-16 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                    {!isCollapsed && (
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="relative group flex-shrink-0">
                                {logoUrl ? (
                                    <img src={logoUrl} alt="Logo" className="h-10 w-10 rounded-md object-cover" />
                                ) : (
                                    <div className="h-10 w-10 bg-gray-700 rounded-md flex items-center justify-center">
                                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                )}
                                {isEditMode && !isAuditor && (
                                    <button onClick={handleLogoEdit} className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 flex items-center justify-center rounded-md transition-opacity cursor-pointer" title="เปลี่ยนโลโก้">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white opacity-0 group-hover:opacity-100" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                                    </button>
                                )}
                            </div>
                            <div className="overflow-hidden">
                                {isEditMode && !isAuditor ? (
                                    <input
                                        type="text"
                                        value={restaurantName}
                                        onChange={(e) => onUpdateRestaurantName(e.target.value)}
                                        className="text-base font-semibold text-white leading-tight block truncate bg-gray-700 p-1 -m-1 rounded-md w-full focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                    />
                                ) : (
                                    <span className="text-base font-semibold text-white leading-tight block truncate">{restaurantName}</span>
                                )}
                                <p className="text-xs text-gray-400 truncate">{branchName}</p>
                            </div>
                        </div>
                    )}
                    <button onClick={onToggleCollapse} className="p-2 text-gray-400 rounded-lg hover:bg-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                </div>
                
                {/* User Profile */}
                <div className="p-4 border-b border-gray-700 flex flex-col gap-3">
                    <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
                        <div className="relative group">
                            <img className="h-12 w-12 rounded-full object-cover" src={currentUser.profilePictureUrl || "https://img.icons8.com/fluency/48/user-male-circle.png"} alt="User"/>
                            {isEditMode && !isAuditor && (
                                <button onClick={handleProfilePictureEdit} className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 flex items-center justify-center rounded-full transition-opacity cursor-pointer" title="เปลี่ยนรูปโปรไฟล์">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white opacity-0 group-hover:opacity-100" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                    </svg>
                                </button>
                            )}
                        </div>
                        {!isCollapsed && (
                            <div>
                                <p className="font-semibold text-white">{currentUser.username}</p>
                                <p className={`text-sm font-semibold ${
                                    currentUser.role === 'admin' ? 'text-red-400' :
                                    currentUser.role === 'branch-admin' ? 'text-purple-400' :
                                    currentUser.role === 'kitchen' ? 'text-orange-400' :
                                    currentUser.role === 'auditor' ? 'text-gray-400' :
                                    'text-blue-400'
                                }`}>
                                    {roleText}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* DB & Printer Status */}
                    <div className={`grid grid-cols-1 gap-2 mt-1 ${isCollapsed ? 'hidden' : 'block'}`}>
                        {/* Cloud DB Status */}
                        <div className={`flex items-center gap-2 p-1.5 rounded w-full transition-colors ${isDbConnected ? 'text-green-400 bg-green-900/20' : 'text-red-400 bg-red-900/20 animate-pulse'}`}>
                            <div className={`w-2 h-2 rounded-full ${isDbConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            <span className="text-xs font-medium">{isDbConnected ? 'Database: Connected' : 'Database: Error'}</span>
                        </div>
                    </div>
                    
                    <div className={`grid grid-cols-2 gap-2 mt-1 ${isCollapsed ? 'hidden' : 'block'}`}>
                        <SidebarPrinterStatus type="kitchen" status={kitchenStatus} onClick={() => checkPrinter('kitchen')} isCollapsed={isCollapsed} />
                        <SidebarPrinterStatus type="cashier" status={cashierStatus} onClick={() => checkPrinter('cashier')} isCollapsed={isCollapsed} />
                    </div>

                    {/* Order Notification Toggle */}
                    {!isAuditor && (
                         <div className={`flex ${isCollapsed ? 'justify-center' : 'items-center'} mt-2`}>
                            <label className="relative inline-flex items-center cursor-pointer" title="เปิด/ปิด การแจ้งเตือนออเดอร์">
                                <input type="checkbox" checked={isOrderNotificationsEnabled} onChange={onToggleOrderNotifications} className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                {!isCollapsed && <span className="ml-3 text-sm font-medium text-gray-300">แจ้งเตือนออเดอร์</span>}
                            </label>
                        </div>
                    )}

                    {/* Edit Mode Toggle */}
                    {canEdit && !isAuditor && (
                        <div className={`flex ${isCollapsed ? 'justify-center' : 'items-center'}`}>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={isEditMode} onChange={onToggleEditMode} className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-400"></div>
                                {!isCollapsed && <span className="ml-3 text-sm font-medium text-gray-300">โหมดแก้ไข</span>}
                            </label>
                        </div>
                    )}
                </div>

                 <input
                    type="file"
                    ref={logoInputRef}
                    onChange={handleLogoFileChange}
                    accept="image/*"
                    className="hidden"
                />
                
                <input
                    type="file"
                    ref={profileInputRef}
                    onChange={handleProfileFileChange}
                    accept="image/*"
                    className="hidden"
                />
                 
                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 overflow-y-auto overflow-x-hidden">
                    <ul className="space-y-1">
                        {/* ... (Menu items remain unchanged) ... */}
                        {isAuditor && (
                            <>
                                <NavItem
                                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>}
                                    text="Dashboard"
                                    isCollapsed={isCollapsed}
                                    isActive={currentView === 'dashboard'}
                                    onClick={() => onViewChange('dashboard')}
                                />
                                <NavItem
                                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                                    text="ประวัติ"
                                    isCollapsed={isCollapsed}
                                    isActive={currentView === 'history'}
                                    onClick={() => onViewChange('history')}
                                />
                                <NavItem
                                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                                    text="วันลา"
                                    isCollapsed={isCollapsed}
                                    isOpen={openMenus['leave']}
                                    onToggle={() => toggleMenu('leave')}
                                    badge={leaveBadgeCount}
                                >
                                    <SubNavItem text="ปฏิทิน" isActive={currentView === 'leave'} onClick={() => onViewChange('leave')} />
                                    <SubNavItem text="สถิติและการคาดการณ์" isActive={currentView === 'leave-analytics'} onClick={() => onViewChange('leave-analytics')} />
                                </NavItem>
                            </>
                        )}

                        {!isAuditor && (
                            <>
                                <NavItem
                                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h2a1 1 0 100-2H9z" clipRule="evenodd" /></svg>}
                                    text="POS"
                                    isCollapsed={isCollapsed}
                                    isActive={currentView === 'pos'}
                                    onClick={() => onViewChange('pos')}
                                />
                                <NavItem
                                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2-2H4a2 2 0 01-2-2V5zm2 1v8h8V6H4z" /></svg>}
                                    text="โต๊ะ"
                                    isCollapsed={isCollapsed}
                                    isActive={currentView === 'tables'}
                                    onClick={() => onViewChange('tables')}
                                    badge={tablesBadgeCount}
                                />
                                <NavItem
                                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h10a3 3 0 013 3v5a.997.997 0 01-.293.707zM5 6a1 1 0 100 2 1 1 0 000-2zm3 0a1 1 0 100 2 1 1 0 000-2zm3 0a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" /></svg>}
                                    text="ครัว"
                                    isCollapsed={isCollapsed}
                                    isActive={currentView === 'kitchen'}
                                    onClick={() => onViewChange('kitchen')}
                                    badge={kitchenBadgeCount}
                                />

                                <NavItem
                                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>}
                                    text="Dashboard"
                                    isCollapsed={isCollapsed}
                                    isActive={currentView === 'dashboard'}
                                    onClick={() => onViewChange('dashboard')}
                                />
                                <NavItem
                                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                                    text="ประวัติ"
                                    isCollapsed={isCollapsed}
                                    isActive={currentView === 'history'}
                                    onClick={() => onViewChange('history')}
                                />
                                
                                <NavItem
                                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
                                    text="สต็อก"
                                    isCollapsed={isCollapsed}
                                    isOpen={openMenus['stock']}
                                    onToggle={() => toggleMenu('stock')}
                                    badge={stockBadgeCount}
                                >
                                    <SubNavItem text="จัดการสินค้า" isActive={currentView === 'stock'} onClick={() => onViewChange('stock')} />
                                    <SubNavItem text="สถิติการเบิก" isActive={currentView === 'stock-analytics'} onClick={() => onViewChange('stock-analytics')} />
                                </NavItem>

                                <NavItem
                                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                                    text="บำรุงรักษา"
                                    isCollapsed={isCollapsed}
                                    isActive={currentView === 'maintenance'}
                                    onClick={() => onViewChange('maintenance')}
                                    badge={maintenanceBadgeCount}
                                />

                                <NavItem
                                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                                    text="วันลา"
                                    isCollapsed={isCollapsed}
                                    isOpen={openMenus['leave']}
                                    onToggle={() => toggleMenu('leave')}
                                    badge={leaveBadgeCount}
                                >
                                    <SubNavItem text="ปฏิทิน" isActive={currentView === 'leave'} onClick={() => onViewChange('leave')} />
                                    <SubNavItem text="สถิติและการคาดการณ์" isActive={currentView === 'leave-analytics'} onClick={() => onViewChange('leave-analytics')} />
                                </NavItem>

                                <hr className="my-4 border-gray-700" />
                                <NavItem
                                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>}
                                    text="ตั้งค่าร้านค้า"
                                    isCollapsed={isCollapsed}
                                    onClick={onOpenSettings}
                                />
                                <NavItem
                                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
                                    text="จัดการผู้ใช้"
                                    isCollapsed={isCollapsed}
                                    onClick={onOpenUserManager}
                                />
                                {/* Hidden as requested:
                                <NavItem
                                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
                                    text="จัดการสาขา"
                                    isCollapsed={isCollapsed}
                                    onClick={onManageBranches}
                                />
                                */}
                            </>
                        )}

                        <hr className="my-4 border-gray-700" />
                        
                        {/* Hidden as requested:
                        <NavItem
                            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>}
                            text="เปลี่ยนสาขา"
                            isCollapsed={isCollapsed}
                            onClick={onChangeBranch}
                        />
                        */}

                        <NavItem
                            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>}
                            text="ออกจากระบบ"
                            isCollapsed={isCollapsed}
                            onClick={onLogout}
                        />
                    </ul>
                </nav>
            </div>
        </aside>
    );
};

export default AdminSidebar;
