
import React, { useState, useEffect, useMemo } from 'react';
import type { User, View, PrinterConfig, PrinterStatus } from '../types';
import { printerService } from '../services/printerService';
import Swal from 'sweetalert2';

interface HeaderProps {
    currentView: View;
    onViewChange: (view: View) => void;
    isEditMode: boolean;
    onToggleEditMode: () => void;
    onOpenSettings: () => void;
    cookingBadgeCount: number;
    waitingBadgeCount: number;
    tablesBadgeCount: number;
    vacantTablesBadgeCount: number;
    leaveBadgeCount: number; 
    stockBadgeCount: number; 
    maintenanceBadgeCount: number; // Added maintenance badge
    currentUser: User | null;
    onLogout: () => void;
    onOpenUserManager: () => void;
    logoUrl: string | null;
    onLogoChangeClick: () => void;
    restaurantName: string;
    onRestaurantNameChange: (newName: string) => void;
    branchName: string;
    onChangeBranch: () => void;
    onManageBranches: () => void;
    printerConfig: PrinterConfig | null; // Added prop
    isAutoPrintEnabled: boolean; // Add this
    onToggleAutoPrint: () => void; // Add this
}

const NavButton: React.FC<{
    label: string;
    isActive: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    badge?: number;
    bottomBadge?: number;
    disabled?: boolean;
    activeClassName: string;
}> = ({ label, isActive, onClick, icon, badge, bottomBadge, disabled = false, activeClassName }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-base font-semibold transition-all ${
            isActive
                ? activeClassName
                : 'text-gray-600 hover:bg-gray-200 hover:text-gray-800'
        } ${disabled ? 'opacity-50 cursor-not-allowed hover:bg-transparent' : ''}`}
    >
        {icon}
        <span className="hidden sm:inline">{label}</span>
        {badge !== undefined && badge > 0 && (
            <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                {badge > 99 ? '99+' : badge}
            </span>
        )}
        {bottomBadge !== undefined && bottomBadge >= 0 && (
             <span className="absolute -bottom-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white border-2 border-white">
                {bottomBadge > 99 ? '99+' : bottomBadge}
            </span>
        )}
    </button>
);

const PrinterStatusIndicator: React.FC<{ 
    type: 'kitchen' | 'cashier'; 
    status: PrinterStatus; 
    onClick: () => void; 
}> = ({ type, status, onClick }) => {
    const icon = type === 'kitchen' ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
    ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
    );

    let colorClass = "bg-gray-200 text-gray-400"; // Idle/Unknown
    let title = "คลิกเพื่อตรวจสอบสถานะ";

    if (status === 'checking') {
        colorClass = "bg-yellow-100 text-yellow-600 animate-pulse";
        title = "กำลังตรวจสอบ...";
    } else if (status === 'success') {
        colorClass = "bg-green-100 text-green-600";
        title = "พร้อมใช้งาน (Online)";
    } else if (status === 'error') {
        colorClass = "bg-red-100 text-red-600";
        title = "ไม่พร้อมใช้งาน (Offline/Error)";
    }

    return (
        <button 
            onClick={onClick}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold transition-colors ${colorClass} hover:opacity-80`}
            title={`${type === 'kitchen' ? 'เครื่องพิมพ์ครัว' : 'เครื่องพิมพ์ใบเสร็จ'}: ${title}`}
        >
            {icon}
            <div className={`w-2 h-2 rounded-full ${status === 'success' ? 'bg-green-500' : status === 'error' ? 'bg-red-500' : status === 'checking' ? 'bg-yellow-500' : 'bg-gray-400'}`}></div>
        </button>
    );
};

export const Header: React.FC<HeaderProps> = ({ 
    currentView, onViewChange, isEditMode, onToggleEditMode, onOpenSettings, 
    cookingBadgeCount, waitingBadgeCount, tablesBadgeCount, vacantTablesBadgeCount, leaveBadgeCount, stockBadgeCount, maintenanceBadgeCount,
    currentUser, onLogout, onOpenUserManager,
    logoUrl, onLogoChangeClick, restaurantName, onRestaurantNameChange,
    branchName, onChangeBranch, onManageBranches,
    printerConfig,
    isAutoPrintEnabled,
    onToggleAutoPrint
}) => {
    
    const isAdmin = currentUser?.role === 'admin';
    const isKitchenStaff = currentUser?.role === 'kitchen';
    const isPosStaff = currentUser?.role === 'pos';
    
    // Printer Status State
    const [kitchenPrinterStatus, setKitchenPrinterStatus] = useState<PrinterStatus>('idle');
    const [cashierPrinterStatus, setCashierPrinterStatus] = useState<PrinterStatus>('idle');

    const checkPrinter = async (type: 'kitchen' | 'cashier') => {
        if (!printerConfig) return;
        const config = printerConfig[type];
        
        if (!config || !config.ipAddress) {
            if (type === 'kitchen') setKitchenPrinterStatus('idle');
            else setCashierPrinterStatus('idle');
            return;
        }

        if (type === 'kitchen') setKitchenPrinterStatus('checking');
        else setCashierPrinterStatus('checking');

        try {
            const res = await printerService.checkPrinterStatus(
                config.ipAddress,
                config.port || '3000',
                config.targetPrinterIp || '',
                config.targetPrinterPort || '9100',
                config.connectionType
            );
            
            if (type === 'kitchen') setKitchenPrinterStatus(res.online ? 'success' : 'error');
            else setCashierPrinterStatus(res.online ? 'success' : 'error');
        } catch (error) {
            if (type === 'kitchen') setKitchenPrinterStatus('error');
            else setCashierPrinterStatus('error');
        }
    };

    // Auto-check on mount and every 60s
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

    const handleProfileClick = () => {
        Swal.fire({
            title: 'ยืนยันการออกจากระบบ',
            text: "ท่านต้องการออกจากระบบใช่ไหม?",
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'ใช่',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6'
        }).then((result) => {
            if (result.isConfirmed) {
                onLogout();
            }
        });
    };

    return (
        <header className="bg-white shadow-md p-3 sticky top-0 z-40 hidden md:block">
            <div className="flex justify-between items-center max-w-screen-2xl mx-auto">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        {logoUrl ? (
                            <img src={logoUrl} alt="Restaurant Logo" className="h-10 w-10 rounded-md object-cover" />
                        ) : (
                            <div className="h-10 w-10 bg-blue-100 rounded-md flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.125-1.274-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.125-1.274.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                        )}
                        {isAdmin && (
                            <button onClick={onLogoChangeClick} className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-50 flex items-center justify-center rounded-md transition-opacity group" title="เปลี่ยนโลโก้">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                            </button>
                        )}
                    </div>
                    <div className="hidden md:block">
                        {isEditMode && isAdmin ? (
                            <input type="text" value={restaurantName} onChange={(e) => onRestaurantNameChange(e.target.value)} className="text-xl font-bold text-gray-800 p-1 border-b-2 border-blue-500 focus:ring-0 focus:border-blue-600 bg-blue-50 rounded-none"/>
                        ) : (
                            <h1 className="text-xl font-bold text-gray-800">{restaurantName}</h1>
                        )}
                        <div className="flex items-center gap-2">
                            <p className="text-sm text-gray-800 font-medium">{branchName}</p>
                            {/* Printer Status Indicators */}
                            <div className="flex items-center gap-1 ml-2 pl-2 border-l border-gray-300">
                                <PrinterStatusIndicator type="kitchen" status={kitchenPrinterStatus} onClick={() => checkPrinter('kitchen')} />
                                <PrinterStatusIndicator type="cashier" status={cashierPrinterStatus} onClick={() => checkPrinter('cashier')} />
                            </div>
                        </div>
                    </div>
                </div>

                <nav className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-xl">
                    <NavButton label="POS" isActive={currentView === 'pos'} onClick={() => onViewChange('pos')} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h2a1 1 0 100-2H9z" clipRule="evenodd" /></svg>} activeClassName="bg-blue-600 hover:bg-blue-700 text-white shadow-md" />
                    <NavButton label="ครัว" isActive={currentView === 'kitchen'} onClick={() => onViewChange('kitchen')} disabled={isPosStaff} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h10a3 3 0 013 3v5a.997.997 0 01-.293.707zM5 6a1 1 0 100 2 1 1 0 000-2zm3 0a1 1 0 100 2 1 1 0 000-2zm3 0a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" /></svg>} badge={cookingBadgeCount} bottomBadge={waitingBadgeCount} activeClassName="bg-orange-500 hover:bg-orange-600 text-white shadow-md" />
                    <NavButton label="ผังโต๊ะ" isActive={currentView === 'tables'} onClick={() => onViewChange('tables')} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2-2H4a2 2 0 01-2-2V5zm2 1v8h8V6H4z" /></svg>} badge={tablesBadgeCount} bottomBadge={vacantTablesBadgeCount} activeClassName="bg-green-500 hover:bg-green-600 text-white shadow-md" />
                    <NavButton label="Dashboard" isActive={currentView === 'dashboard'} onClick={() => onViewChange('dashboard')} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1-1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>} activeClassName="bg-purple-600 hover:bg-purple-700 text-white shadow-md" />
                    <NavButton label="ประวัติ" isActive={currentView === 'history'} onClick={() => onViewChange('history')} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>} activeClassName="bg-teal-500 hover:bg-teal-600 text-white shadow-md" />
                    <NavButton label="สต็อก" isActive={currentView === 'stock'} onClick={() => onViewChange('stock')} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>} activeClassName="bg-cyan-600 hover:bg-cyan-700 text-white shadow-md" badge={stockBadgeCount} />
                    <NavButton 
                        label="บำรุงรักษา" 
                        isActive={currentView === 'maintenance'} 
                        onClick={() => onViewChange('maintenance')}
                        icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                        badge={maintenanceBadgeCount}
                        activeClassName="bg-pink-600 hover:bg-pink-700 text-white shadow-md"
                    />
                    <NavButton 
                        label="วันลา" 
                        isActive={currentView === 'leave'} 
                        onClick={() => onViewChange('leave')}
                        icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>}
                        badge={leaveBadgeCount}
                        activeClassName="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md"
                    />
                </nav>

                <div className="flex items-center gap-4">
                    {/* Auto Print Toggle has been hidden */}

                    {(currentUser.role === 'admin' || currentUser.role === 'branch-admin') && (
                        <div className="relative group">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" checked={isEditMode} onChange={onToggleEditMode} className="sr-only peer" />
                              <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-400"></div>
                              <span className="ml-3 text-sm font-medium text-gray-900 hidden lg:block">โหมดแก้ไข</span>
                            </label>
                        </div>
                    )}
                    
                    <div 
                        className="flex items-center gap-2 border-l pl-4 cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors"
                        onClick={handleProfileClick}
                        title="คลิกเพื่อออกจากระบบ"
                    >
                        <img src={currentUser.profilePictureUrl || "https://img.icons8.com/fluency/48/user-male-circle.png"} alt={currentUser.username} className="h-10 w-10 rounded-full object-cover" />
                        <div>
                            <p className="font-semibold text-gray-800">{currentUser.username}</p>
                            <p className={`text-xs font-semibold ${
                                currentUser.role === 'admin' ? 'text-red-600' :
                                currentUser.role === 'branch-admin' ? 'text-purple-600' :
                                currentUser.role === 'kitchen' ? 'text-orange-600' :
                                'text-blue-600'
                            }`}>{roleText}</p>
                        </div>
                        <button className="p-2 text-gray-500 rounded-full hover:bg-gray-200">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
};
