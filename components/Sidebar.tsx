
import React, { useMemo, useState, useRef } from 'react';
import type { OrderItem, Table, TakeawayCutleryOption, Reservation, User, View, DeliveryProvider } from '../types';
import { OrderListItem } from './OrderListItem';
import { NumpadModal } from './NumpadModal'; // Import NumpadModal
import Swal from 'sweetalert2';
import { ThaiVirtualKeyboard } from './ThaiVirtualKeyboard';

interface SidebarProps {
    currentOrderItems: OrderItem[];
    onQuantityChange: (cartItemId: string, newQuantity: number) => void;
    onRemoveItem: (cartItemId: string) => void;
    onClearOrder: () => void;
    onPlaceOrder: (items: OrderItem[], customerName: string, customerCount: number, tableOverride: Table | null, isLineMan: boolean, lineManNumber?: string, deliveryProviderName?: string) => void;
    isPlacingOrder: boolean;
    tables: Table[];
    selectedTable: Table | null;
    onSelectTable: (tableId: number | null) => void;
    customerName: string;
    onCustomerNameChange: (name: string) => void;
    customerCount: number;
    onCustomerCountChange: (count: number) => void;
    isEditMode: boolean;
    onAddNewTable: (floor: string) => void;
    onRemoveLastTable: (floor: string) => void;
    floors: string[];
    selectedFloor: string;
    onFloorChange: (floor: string) => void;
    onAddFloor: () => void;
    onRemoveFloor: (floor: string) => void;
    sendToKitchen: boolean;
    onSendToKitchenChange: (enabled: boolean, details: { reason: string; notes: string } | null) => void;
    onUpdateReservation: (tableId: number, reservation: Reservation | null) => void;
    onOpenSearch: () => void;
    currentUser: User | null;
    onEditOrderItem: (item: OrderItem) => void;
    onViewChange: (view: View) => void;
    restaurantName: string;
    onLogout: () => void;
    isMobilePage?: boolean;
    onToggleAvailability: (id: number) => void;
    isOrderNotificationsEnabled: boolean;
    onToggleOrderNotifications: () => void;
    deliveryProviders: DeliveryProvider[];
    onToggleEditMode?: () => void;
    onOpenSettings: () => void; // New prop for Settings
}

export const Sidebar: React.FC<SidebarProps> = ({
    currentOrderItems,
    onQuantityChange,
    onRemoveItem,
    onClearOrder,
    onPlaceOrder,
    isPlacingOrder,
    tables,
    selectedTable,
    onSelectTable,
    customerName,
    onCustomerNameChange,
    customerCount,
    onCustomerCountChange,
    isEditMode,
    onAddNewTable,
    onRemoveLastTable,
    floors,
    selectedFloor,
    onFloorChange,
    onAddFloor,
    onRemoveFloor,
    sendToKitchen,
    onSendToKitchenChange,
    onUpdateReservation,
    onOpenSearch,
    currentUser,
    onEditOrderItem,
    onViewChange,
    restaurantName,
    onLogout,
    isMobilePage = false,
    onToggleAvailability,
    isOrderNotificationsEnabled,
    onToggleOrderNotifications,
    deliveryProviders,
    onToggleEditMode,
    onOpenSettings
}) => {
    // We treat "isLineMan" as "isDelivery" in the backend logic, so we keep the name for compatibility
    // but locally we track which provider is selected.
    const [isDelivery, setIsDelivery] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<DeliveryProvider | null>(null);
    
    // New state for Numpad & Delivery Selection
    const [isNumpadOpen, setIsNumpadOpen] = useState(false);
    const [isDeliverySelectionOpen, setIsDeliverySelectionOpen] = useState(false);
    const [deliveryOrderNumber, setDeliveryOrderNumber] = useState('');

    // State for Virtual Keyboard
    const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

    // Ref to track if Numpad was submitted successfully
    // This prevents onClose from clearing the provider when we actually wanted to confirm it
    const isNumpadSubmittedRef = useRef(false);

    const activeProviders = useMemo(() => {
        return deliveryProviders.filter(p => p.isEnabled);
    }, [deliveryProviders]);

    const total = useMemo(() => {
        return currentOrderItems.reduce((sum, item) => sum + item.finalPrice * item.quantity, 0);
    }, [currentOrderItems]);

    // If Delivery is active, we allow placing order without a selected table
    const canPlaceOrder = currentOrderItems.length > 0 && (selectedTable !== null || isDelivery);
    
    const availableTables = useMemo(() => {
        return tables.filter(t => t.floor === selectedFloor).sort((a, b) => {
            const numA = parseInt(a.name.replace(/[^0-9]/g, ''), 10);
            const numB = parseInt(b.name.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            return a.name.localeCompare(b.name);
        });
    }, [tables, selectedFloor]);

    const handleProfileClick = () => {
        Swal.fire({
            title: 'ยืนยันการออกจากระบบ',
            text: "ท่านต้องการออกจากระบบใช่ไหม?",
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'ใช่, ออกจากระบบ',
            cancelButtonText: 'ยกเลิก'
        }).then((result) => {
            if (result.isConfirmed) {
                onLogout();
            }
        });
    };

    const handleConfirmPlaceOrder = () => {
        if (!isDelivery && selectedTable === null) {
            Swal.fire('กรุณาเลือกโต๊ะ', 'ต้องเลือกโต๊ะสำหรับออเดอร์ หรือเลือก Delivery', 'warning');
            return;
        }
        if (!canPlaceOrder) return;

        // If Delivery, we pass isLineMan=true (mapping general delivery to existing backend logic)
        // and the manual order number.
        // FIX: Pass the selected provider name to update the header
        onPlaceOrder(
            currentOrderItems, 
            customerName, 
            customerCount, 
            selectedTable, 
            isDelivery, 
            isDelivery ? deliveryOrderNumber : undefined,
            isDelivery ? (selectedProvider?.name || 'Delivery') : undefined
        );
        
        // Reset local state after order is placed
        if (isDelivery) {
            setIsDelivery(false);
            setDeliveryOrderNumber('');
            setSelectedProvider(null);
            onCustomerNameChange('');
        }
    };
    
    const handleFloorChange = (floor: string) => {
        if (selectedFloor !== floor) {
            onFloorChange(floor);
            onSelectTable(null);
        }
    };

    const handleSendToKitchenToggle = async (enabled: boolean) => {
        if (enabled) {
            onSendToKitchenChange(true, null);
        } else {
            const { value: formValues, isConfirmed } = await Swal.fire({
                title: 'ระบุเหตุผลที่ไม่ส่งเข้าครัว',
                width: '500px',
                html: `
                    <select id="swal-reason" class="swal2-select text-gray-800">
                        <option value="" disabled selected>-- เลือกเหตุผล --</option>
                        <option value="ลูกค้าสั่งกลับบ้าน">ลูกค้าสั่งกลับบ้าน</option>
                        <option value="ลูกค้าสั่งอาหารที่เคาน์เตอร์">ลูกค้าสั่งอาหารที่เคาน์เตอร์</option>
                        <option value="เป็นรายการที่ทำเสร็จแล้ว (เช่น เครื่องดื่ม)">เป็นรายการที่ทำเสร็จแล้ว (เช่น เครื่องดื่ม)</option>
                        <option value="ทำออร์เดอร์ผิด">ทำออร์เดอร์ผิด</option>
                        <option value="อื่นๆ">อื่นๆ (ระบุ)</option>
                    </select>
                    <input id="swal-notes" class="swal2-input text-gray-800" placeholder="ระบุเหตุผล..." style="display:none; margin-top: 1em;">
                `,
                confirmButtonText: 'ยืนยัน',
                cancelButtonText: 'ยกเลิก',
                showCancelButton: true,
                focusConfirm: false,
                didOpen: () => {
                    const popup = Swal.getPopup();
                    if (!popup) return;
                    const reasonSelect = popup.querySelector('#swal-reason') as HTMLSelectElement;
                    const notesInput = popup.querySelector('#swal-notes') as HTMLInputElement;
                    if (!reasonSelect || !notesInput) return;
    
                    reasonSelect.addEventListener('change', () => {
                        notesInput.style.display = reasonSelect.value === 'อื่นๆ' ? 'block' : 'none';
                        if (reasonSelect.value === 'อื่นๆ') {
                           notesInput.focus();
                        }
                    });
                },
                preConfirm: () => {
                    const popup = Swal.getPopup();
                    if (!popup) return false;
                    const reason = (popup.querySelector('#swal-reason') as HTMLSelectElement).value;
                    const notes = (popup.querySelector('#swal-notes') as HTMLInputElement).value;
                    if (!reason) {
                        Swal.showValidationMessage('กรุณาเลือกเหตุผล');
                        return false;
                    }
                    if (reason === 'อื่นๆ' && !notes.trim()) {
                        Swal.showValidationMessage('กรุณาระบุเหตุผลในช่อง "อื่นๆ"');
                        return false;
                    }
                    return { reason, notes };
                }
            });
    
            if (isConfirmed && formValues) {
                onSendToKitchenChange(false, { reason: formValues.reason, notes: formValues.notes });
            }
        }
    };

    const handleReservationClick = () => {
        if (!selectedTable) return;

        if (selectedTable.reservation) {
            Swal.fire({
                title: `การจองโต๊ะ ${selectedTable.name}`,
                html: `
                    <div class="text-left p-4 bg-gray-50 rounded-lg space-y-2 text-gray-800">
                        <p><strong>ชื่อผู้จอง:</strong> ${selectedTable.reservation.name}</p>
                        <p><strong>เบอร์โทร:</strong> ${selectedTable.reservation.contact || '-'}</p>
                        <p><strong>เวลา:</strong> ${selectedTable.reservation.time}</p>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'ปิด',
                cancelButtonText: 'ยกเลิกการจอง',
                cancelButtonColor: '#d33',
            }).then((result) => {
                if (result.dismiss === Swal.DismissReason.cancel) {
                    onUpdateReservation(selectedTable.id, null);
                    Swal.fire('ยกเลิกแล้ว', 'การจองสำหรับโต๊ะนี้ถูกยกเลิกแล้ว', 'success');
                }
            });
        } else {
            Swal.fire({
                title: `จองโต๊ะ ${selectedTable.name}`,
                html: `
                    <input id="swal-input-name" class="swal2-input text-gray-800" placeholder="ชื่อผู้จอง">
                    <input id="swal-input-contact" class="swal2-input text-gray-800" placeholder="เบอร์โทร (ถ้ามี)">
                    <input id="swal-input-time" type="time" class="swal2-input text-gray-800">
                `,
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonText: 'ยืนยันการจอง',
                cancelButtonText: 'ยกเลิก',
                preConfirm: () => {
                    const name = (document.getElementById('swal-input-name') as HTMLInputElement).value;
                    const contact = (document.getElementById('swal-input-contact') as HTMLInputElement).value;
                    const time = (document.getElementById('swal-input-time') as HTMLInputElement).value;
                    if (!name || !time) {
                        Swal.showValidationMessage('กรุณากรอกชื่อและเวลา');
                        return false;
                    }
                    return { name, contact, time };
                }
            }).then((result) => {
                if (result.isConfirmed && result.value) {
                    onUpdateReservation(selectedTable.id, result.value);
                    Swal.fire('จองแล้ว', `โต๊ะ ${selectedTable.name} ถูกจองเรียบร้อย`, 'success');
                }
            });
        }
    };

    const handleProviderClick = (provider: DeliveryProvider) => {
        if (selectedProvider?.id === provider.id) {
            // Deselect
            setIsDelivery(false);
            setSelectedProvider(null);
            setDeliveryOrderNumber('');
            onCustomerNameChange('');
        } else {
            // Select and Open Numpad
            setSelectedProvider(provider);
            setIsNumpadOpen(true);
            isNumpadSubmittedRef.current = false; // Reset submission flag when opening
        }
    };

    // Virtual Keyboard Handlers
    const handleVirtualKeyPress = (key: string) => {
        onCustomerNameChange(customerName + key);
    };

    const handleVirtualBackspace = () => {
        onCustomerNameChange(customerName.slice(0, -1));
    };

    const handleVirtualClear = () => {
        onCustomerNameChange('');
    };

    // --- Dynamic Color Logic for Confirm Button ---
    // Modified: Use provider.color directly if available
    const confirmButtonStyle = useMemo(() => {
        if (isDelivery && selectedProvider && selectedProvider.color) {
            return {
                backgroundColor: selectedProvider.color,
                // Add a slight shadow based on color if needed, or stick to simple
            };
        }
        
        // Default Blue for Dine-in or fallback
        return {
            backgroundColor: '#2563eb' // tailwind blue-600
        };
    }, [isDelivery, selectedProvider]);

    return (
        <div className="bg-gray-900 text-white w-full h-full flex flex-col shadow-2xl overflow-hidden border-l border-gray-800 transition-all duration-200 relative">
            {isMobilePage && currentUser && (
                <header className="p-3 flex justify-between items-center flex-shrink-0 z-30 shadow-lg border-b border-gray-800 relative">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={handleProfileClick}>
                        <img 
                            src={currentUser.profilePictureUrl || "https://img.icons8.com/fluency/48/user-male-circle.png"} 
                            alt={currentUser.username} 
                            className="h-10 w-10 rounded-full object-cover border-2 border-gray-700"
                        />
                        <div>
                            <p className="font-semibold text-white leading-none">{currentUser.username}</p>
                            <span className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded font-mono">{currentUser.role}</span>
                        </div>
                    </div>
                    {/* Centered Title */}
                    <h1 className="text-xl font-bold text-red-500 absolute left-1/2 -translate-x-1/2 whitespace-nowrap overflow-hidden max-w-[20%] text-ellipsis">
                        {restaurantName}
                    </h1>
                    <div className="flex items-center gap-2">
                        {/* Settings Button (Added) */}
                        <button 
                            onClick={onOpenSettings} 
                            className="p-2 text-gray-300 rounded-full hover:bg-gray-700"
                            aria-label="Settings"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.572 1.065c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>

                        {/* Edit Mode Toggle for Admin/Manager */}
                        {(currentUser.role === 'admin' || currentUser.role === 'branch-admin') && onToggleEditMode && (
                            <button
                                onClick={onToggleEditMode}
                                className={`p-2 rounded-full transition-colors ${isEditMode ? 'bg-yellow-500 text-black' : 'text-gray-300 hover:bg-gray-700'}`}
                                title="โหมดแก้ไข"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </button>
                        )}
                        <button 
                            onClick={onOpenSearch} 
                            className="p-2 text-gray-300 rounded-full hover:bg-gray-700"
                            aria-label="Search Menu"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </button>
                    </div>
                </header>
            )}
            
            {/* Top section for customer info and tables */}
            <div className="p-4 space-y-4 flex-shrink-0 bg-gray-900 overflow-y-auto">
                {/* Customer Info */}
                <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-400">ชื่อลูกค้า (ถ้ามี)</label>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="เช่น คุณสมชาย"
                            value={customerName}
                            onChange={(e) => onCustomerNameChange(e.target.value)}
                            className="w-full p-3 pr-12 bg-gray-800 rounded-lg border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                        />
                        <button 
                            className={`absolute inset-y-0 right-0 flex items-center pr-3 transition-colors ${isKeyboardOpen ? 'text-blue-500' : 'text-gray-400 hover:text-blue-500'}`}
                            onClick={() => setIsKeyboardOpen(!isKeyboardOpen)}
                            title={isKeyboardOpen ? "ปิดแป้นพิมพ์" : "เปิดแป้นพิมพ์ไทย"}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Floor Selection (Disable if Delivery) */}
                <div className={isDelivery ? "opacity-50 pointer-events-none" : ""}>
                    <label className="text-xs font-medium text-gray-400">เลือกชั้น:</label>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                        {floors.map(floor => (
                            <button
                                key={floor}
                                onClick={() => handleFloorChange(floor)}
                                className={`py-2 px-4 rounded-lg font-semibold transition-all border ${selectedFloor === floor ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700 hover:border-gray-600'}`}
                            >
                                {floor}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Table and Customer Count */}
                <div className="grid grid-cols-2 gap-4">
                    <div className={isDelivery ? "opacity-50 pointer-events-none" : ""}>
                        <label htmlFor="table-select" className="block text-xs font-medium text-gray-400 mb-1">เลือกโต๊ะ:</label>
                        <select
                            id="table-select"
                            value={selectedTable?.id || ''}
                            onChange={(e) => onSelectTable(e.target.value ? Number(e.target.value) : null)}
                            className="w-full p-2.5 bg-gray-800 rounded-lg border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                        >
                             <option value="">-- กรุณาเลือกโต๊ะ --</option>
                            {availableTables.map(table => (
                                <option key={table.id} value={table.id}>{table.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="customer-count" className="block text-xs font-medium text-gray-400 mb-1">ลูกค้า:</label>
                        <div className="flex items-center h-[42px]">
                            <button onClick={() => onCustomerCountChange(Math.max(1, customerCount - 1))} className="w-10 h-full bg-gray-800 border border-gray-700 border-r-0 rounded-l-lg hover:bg-gray-700 text-gray-300 hover:text-white transition-colors">-</button>
                            <input
                                id="customer-count"
                                type="number"
                                value={customerCount}
                                onChange={(e) => onCustomerCountChange(Math.max(1, Number(e.target.value)))}
                                className="w-full h-full bg-gray-900 text-center border-y border-gray-700 text-white focus:outline-none focus:ring-0 appearance-none [-moz-appearance:textfield]"
                            />
                            <button onClick={() => onCustomerCountChange(customerCount + 1)} className="w-10 h-full bg-gray-800 border border-gray-700 border-l-0 rounded-r-lg hover:bg-gray-700 text-gray-300 hover:text-white transition-colors">+</button>
                        </div>
                    </div>
                </div>

                {/* Delivery Provider Buttons (Dynamic Colors) - NOW HIDDEN ON MOBILE */}
                {!isMobilePage && activeProviders.length > 0 && (
                    <div className="bg-gray-800 p-2 rounded-lg border border-gray-700">
                        <div className="grid grid-cols-2 gap-2">
                            {activeProviders.map(provider => {
                                const isSelected = selectedProvider?.id === provider.id;
                                // Use custom color or default gray
                                const buttonStyle = isSelected && provider.color
                                    ? { borderColor: provider.color, backgroundColor: 'rgba(55, 65, 81, 1)' } // gray-700 base with colored border
                                    : {};
                                const textStyle = isSelected && provider.color
                                    ? { color: provider.color }
                                    : {};
                                const ringStyle = isSelected && provider.color
                                    ? { boxShadow: `0 0 0 2px ${provider.color}` }
                                    : {};

                                return (
                                    <button
                                        key={provider.id}
                                        onClick={() => handleProviderClick(provider)}
                                        style={buttonStyle}
                                        className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                                            isSelected 
                                                ? 'bg-gray-700 shadow-sm' 
                                                : 'bg-transparent border-gray-600 hover:bg-gray-700 hover:border-gray-50'
                                        }`}
                                    >
                                        <div 
                                            className={`w-5 h-5 rounded-md flex items-center justify-center overflow-hidden flex-shrink-0 bg-white`}
                                            style={ringStyle}
                                        >
                                            {provider.iconUrl ? (
                                                <img src={provider.iconUrl} alt={provider.name} className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display = 'none'} />
                                            ) : (
                                                <span className="text-xs text-gray-800 font-bold">{provider.name.charAt(0)}</span>
                                            )}
                                        </div>
                                        <span 
                                            className={`text-sm font-semibold truncate ${!isSelected ? 'text-gray-300' : ''}`}
                                            style={textStyle}
                                        >
                                            {provider.name} {isSelected && deliveryOrderNumber ? `#${deliveryOrderNumber}` : ''}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Reservation button */}
                {selectedTable && !isMobilePage && !isDelivery && (
                    <div>
                        <button
                            onClick={handleReservationClick}
                            className={`w-full py-2.5 rounded-lg font-semibold transition-colors shadow-sm ${selectedTable.reservation ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                        >
                            {selectedTable.reservation ? 'ดูการจอง' : 'จองโต๊ะนี้'}
                        </button>
                    </div>
                )}
            </div>

            {/* Order Items List - Scrollable area */}
            <div 
                className="flex-1 overflow-y-auto px-4 py-2 space-y-2 min-h-0 bg-gray-900"
            >
                {currentOrderItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600">
                         <div className="bg-gray-800 p-6 rounded-full mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                         </div>
                        <p className="text-lg font-medium">ยังไม่มีรายการอาหาร</p>
                        <p className="text-sm">เลือกเมนูเพื่อเริ่มสั่ง</p>
                    </div>
                ) : (
                    currentOrderItems.map(item => (
                        <OrderListItem
                            key={item.cartItemId}
                            item={item}
                            onRemoveItem={onRemoveItem}
                            onEditItem={onEditOrderItem}
                        />
                    ))
                )}
            </div>

            {/* Footer section */}
            <div className="p-4 border-t border-gray-800 flex-shrink-0 space-y-4 bg-gray-900">
                {!isMobilePage && (
                    <label className="flex items-center gap-3 text-sm cursor-pointer p-2 rounded-lg hover:bg-gray-800 transition-colors">
                        <div className="relative flex items-center">
                            <input
                                type="checkbox"
                                checked={sendToKitchen}
                                onChange={(e) => handleSendToKitchenToggle(e.target.checked)}
                                className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-gray-600 bg-gray-800 checked:bg-blue-600 checked:border-blue-600 transition-all"
                            />
                            <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                        <span className="font-medium text-gray-300">ส่งไปที่ห้องครัว</span>
                    </label>
                )}
                
                <div className="flex justify-between items-baseline">
                    <span className="text-gray-400 font-medium">ยอดรวม</span>
                    <div className="flex items-baseline gap-1 flex-wrap justify-end">
                        <span className="text-4xl font-bold text-yellow-400 tracking-tight">{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <span className="text-xl text-yellow-600 font-medium">฿</span>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    {/* Mobile Delivery Button (Simplified) */}
                    {isMobilePage ? (
                        <button
                            onClick={() => {
                                if (!isDelivery) {
                                    if (activeProviders.length > 1) {
                                        setIsDeliverySelectionOpen(true);
                                    } else if (activeProviders.length === 1) {
                                        setSelectedProvider(activeProviders[0]);
                                        setIsNumpadOpen(true);
                                        isNumpadSubmittedRef.current = false; // Reset ref
                                    } else {
                                        Swal.fire({
                                            title: 'ไม่พบผู้ให้บริการ',
                                            text: 'กรุณาเปิดใช้งาน Delivery Provider ในหน้าตั้งค่า',
                                            icon: 'warning',
                                            confirmButtonText: 'ตกลง'
                                        });
                                    }
                                } else {
                                    setIsDelivery(false);
                                    setDeliveryOrderNumber('');
                                    onCustomerNameChange('');
                                    setSelectedProvider(null);
                                }
                            }}
                            className={`col-span-1 flex flex-col items-center justify-center p-2 rounded-xl font-bold transition-all border leading-none gap-1 active:scale-95 ${
                                isDelivery 
                                    ? 'bg-green-600 text-white border-green-500 shadow-lg shadow-green-900/50' 
                                    : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700 hover:text-white'
                            }`}
                        >
                            <span>Delivery</span>
                            <div className={`w-1.5 h-1.5 rounded-full ${isDelivery ? 'bg-white' : 'bg-gray-600'}`}></div>
                        </button>
                    ) : (
                        <button
                            onClick={onClearOrder}
                            className="col-span-1 bg-gray-800 border border-gray-700 p-3 rounded-xl hover:bg-gray-700 hover:border-gray-600 hover:text-white text-gray-400 font-semibold transition-all"
                        >
                            ล้าง
                        </button>
                    )}
                    
                    <button
                        onClick={handleConfirmPlaceOrder}
                        disabled={isPlacingOrder}
                        style={!isPlacingOrder ? confirmButtonStyle : {}} // Apply dynamic style
                        className={`col-span-2 flex-grow p-3 rounded-xl text-white font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all transform active:scale-95 hover:brightness-110`}
                    >
                        {isPlacingOrder ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                <span>กำลังส่ง...</span>
                            </>
                        ) : !canPlaceOrder ? (
                            'กรุณาเลือกโต๊ะ'
                        ) : (
                            isDelivery ? `ยืนยัน (${selectedProvider?.name || 'Delivery'} #${deliveryOrderNumber})` : 'ยืนยันออเดอร์'
                        )}
                    </button>
                </div>
                {isEditMode && !isMobilePage && (
                    <div className="p-3 mt-2 border-t border-gray-800 space-y-2 bg-gray-800/50 rounded-lg">
                        <h3 className="text-xs font-bold text-center text-gray-500 uppercase tracking-wider">โหมดแก้ไข</h3>
                         <div className="grid grid-cols-2 gap-2">
                            <button onClick={onAddFloor} className="w-full bg-indigo-600/80 p-2 rounded-lg hover:bg-indigo-600 text-xs font-semibold">เพิ่มชั้น</button>
                            <button onClick={() => onRemoveFloor(selectedFloor)} className="w-full bg-red-900/80 p-2 rounded-lg hover:bg-red-800 text-xs font-semibold">ลบชั้น</button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => onAddNewTable(selectedFloor)} className="w-full bg-blue-600/80 p-2 rounded-lg hover:bg-blue-600 text-xs font-semibold">เพิ่มโต๊ะ</button>
                            <button onClick={() => onRemoveLastTable(selectedFloor)} className="w-full bg-red-600/80 p-2 rounded-lg hover:bg-red-600 text-xs font-semibold">ลบโต๊ะ</button>
                        </div>
                        <p className="text-center text-gray-600 text-[10px]">โต๊ะใน "{selectedFloor}": {availableTables.length}</p>
                    </div>
                )}
            </div>

            <NumpadModal
                isOpen={isNumpadOpen}
                onClose={() => {
                    setIsNumpadOpen(false);
                    // Check ref to see if we submitted or just closed
                    if (!isNumpadSubmittedRef.current && !isDelivery) {
                        setSelectedProvider(null);
                    }
                }}
                title={`ระบุหมายเลข ${selectedProvider?.name || 'Order'}`}
                initialValue="" 
                allowLeadingZeros={true} 
                onSubmit={(value) => {
                    isNumpadSubmittedRef.current = true; // Mark as submitted
                    const numStr = value || '0';
                    setDeliveryOrderNumber(numStr);
                    setIsDelivery(true);
                    onSelectTable(null); // Clear table selection
                    onCustomerNameChange(`${selectedProvider?.name || 'Delivery'} #${numStr}`); // Auto-fill customer name with provider
                }}
            />

            {/* Delivery Provider Selection Modal (Mobile) */}
            {isDeliverySelectionOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4" onClick={() => setIsDeliverySelectionOpen(false)}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800">เลือกบริการ Delivery</h3>
                            <button onClick={() => setIsDeliverySelectionOpen(false)} className="text-gray-500 hover:text-gray-700">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-4 grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
                            {activeProviders.map(provider => (
                                <button
                                    key={provider.id}
                                    onClick={() => {
                                        setIsDeliverySelectionOpen(false);
                                        setSelectedProvider(provider);
                                        setIsNumpadOpen(true);
                                        isNumpadSubmittedRef.current = false; // Reset ref here too
                                    }}
                                    className="flex flex-col items-center justify-center p-4 border rounded-xl hover:bg-blue-50 hover:border-blue-300 transition-all gap-2"
                                    style={{ borderColor: provider.color }}
                                >
                                    {provider.iconUrl ? (
                                        <img src={provider.iconUrl} alt={provider.name} className="w-12 h-12 object-cover rounded-md" onError={(e) => e.currentTarget.style.display = 'none'} />
                                    ) : (
                                        <div 
                                            className="w-12 h-12 rounded-md flex items-center justify-center text-white font-bold text-xl"
                                            style={{ backgroundColor: provider.color || '#9ca3af' }}
                                        >
                                            {provider.name.charAt(0)}
                                        </div>
                                    )}
                                    <span 
                                        className="font-semibold text-gray-800 text-sm text-center"
                                        style={{ color: provider.color }}
                                    >
                                        {provider.name}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Virtual Keyboard Overlay */}
            {isKeyboardOpen && (
                <ThaiVirtualKeyboard 
                    onKeyPress={handleVirtualKeyPress}
                    onBackspace={handleVirtualBackspace}
                    onClear={handleVirtualClear}
                    onClose={() => setIsKeyboardOpen(false)}
                />
            )}
        </div>
    );
};