
import React, { useState, useMemo, useEffect } from 'react';
import Swal from 'sweetalert2';
import type { Table, MenuItem, ActiveOrder, CompletedOrder, OrderItem } from '../types';
import { MenuItemImage } from './MenuItemImage';
import { ItemCustomizationModal } from './ItemCustomizationModal';

interface CustomerViewProps {
    table: Table;
    menuItems: MenuItem[];
    categories: string[];
    activeOrders: ActiveOrder[];
    allBranchOrders: ActiveOrder[];
    completedOrders: CompletedOrder[];
    onPlaceOrder: (items: OrderItem[], customerName: string) => Promise<ActiveOrder | undefined>;
    onStaffCall: (table: Table, customerName: string) => void;
    recommendedMenuItemIds: number[];
    logoUrl: string | null;
    restaurantName: string;
}

export const CustomerView: React.FC<CustomerViewProps> = ({
    table,
    menuItems,
    categories,
    activeOrders,
    allBranchOrders,
    completedOrders,
    onPlaceOrder,
    onStaffCall,
    recommendedMenuItemIds,
    logoUrl,
    restaurantName
}) => {
    const [selectedCategory, setSelectedCategory] = useState<string>(categories[0] || 'ทั้งหมด');
    const [cartItems, setCartItems] = useState<OrderItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [itemToCustomize, setItemToCustomize] = useState<MenuItem | null>(null);
    const [customerName, setCustomerName] = useState('');
    
    // To track orders placed by this session (simple local storage or state if persistent)
    const [myOrderNumbers, setMyOrderNumbers] = useState<number[]>([]);
    const [optimisticOrders, setOptimisticOrders] = useState<ActiveOrder[]>([]);

    // Simple translation helper placeholder
    const t = (s: string) => s;

    // Filter active orders for THIS table
    const myActiveOrders = useMemo(() => {
        return activeOrders.filter(o => o.tableId === table.id);
    }, [activeOrders, table.id]);

    const totalBillAmount = useMemo(() => {
        const activeTotal = myActiveOrders.reduce((sum, order) => {
            const orderSub = order.items.reduce((s, i) => s + (i.finalPrice * i.quantity), 0);
            return sum + orderSub + order.taxAmount;
        }, 0);
        
        // Also consider completed orders if needed (though usually they leave after paying)
        // For simplicity, we just show active bill pending payment
        return activeTotal;
    }, [myActiveOrders]);

    const totalBillItemsCount = useMemo(() => {
        return myActiveOrders.reduce((count, order) => {
            return count + order.items.reduce((c, i) => c + i.quantity, 0);
        }, 0);
    }, [myActiveOrders]);

    // Filter items
    const filteredItems = useMemo(() => {
        let items = menuItems.filter(item => item.isVisible !== false && item.isAvailable !== false); // Show only visible and available
        if (selectedCategory !== 'ทั้งหมด') {
            items = items.filter(i => i.category === selectedCategory);
        }
        return items;
    }, [menuItems, selectedCategory]);

    // Check for payment completion (Auto Exit)
    useEffect(() => {
        // Condition: Table WAS active (has history of orders) but now has NO active orders, 
        // AND there is a very recent completed order for this table (e.g. within last minute)
        // This prevents the "Thank You" screen from showing immediately if they just sat down at an empty table.
        
        const hasActive = myActiveOrders.length > 0;
        
        if (!hasActive) {
            // Check if there is a completed order for this table in the last 60 seconds
            const recentCompleted = completedOrders.find(o => 
                o.tableId === table.id && 
                (Date.now() - o.completionTime) < 60000 // 1 minute window
            );

            if (recentCompleted) {
                Swal.fire({
                    icon: 'success',
                    title: 'ขอบคุณที่ใช้บริการ',
                    text: 'การชำระเงินเสร็จสิ้นแล้ว หวังว่าจะได้ให้บริการท่านอีกครั้ง',
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    confirmButtonText: 'ปิดหน้าต่าง',
                    backdrop: `
                        rgba(0,0,123,0.4)
                        url("/images/nyan-cat.gif")
                        left top
                        no-repeat
                    `
                }).then(() => {
                    // Close window if possible, or reload to clear state (simulating exit)
                    window.location.reload(); 
                });
            }
        }
    }, [myActiveOrders, completedOrders, table.id]);


    const handleAddToCart = (item: MenuItem) => {
        if (item.optionGroups && item.optionGroups.length > 0) {
            setItemToCustomize(item);
        } else {
            const newItem: OrderItem = {
                ...item,
                quantity: 1,
                isTakeaway: false,
                cartItemId: `${item.id}-${Date.now()}`,
                finalPrice: item.price,
                selectedOptions: []
            };
            setCartItems(prev => [...prev, newItem]);
            
            // Visual feedback
            const toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 1000,
                timerProgressBar: true,
            });
            toast.fire({
                icon: 'success',
                title: `เพิ่ม ${item.name} แล้ว`
            });
        }
    };

    const handleConfirmCustomization = (itemToAdd: OrderItem) => {
        setCartItems(prev => [...prev, itemToAdd]);
        setItemToCustomize(null);
    };

    const handleRemoveFromCart = (cartItemId: string) => {
        setCartItems(prev => prev.filter(i => i.cartItemId !== cartItemId));
    };

    const handleStaffCallClick = () => {
        Swal.fire({
            title: 'เรียกพนักงาน?',
            text: 'พนักงานจะมาที่โต๊ะของคุณสักครู่',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'เรียกเลย',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33'
        }).then((result) => {
            if (result.isConfirmed) {
                onStaffCall(table, customerName || 'ลูกค้า');
                Swal.fire({
                    icon: 'success',
                    title: 'เรียกพนักงานแล้ว',
                    timer: 1500,
                    showConfirmButton: false
                });
            }
        });
    };

    const handleViewBill = () => {
        if (myActiveOrders.length === 0) {
            Swal.fire('ยังไม่มีรายการ', 'คุณยังไม่ได้สั่งอาหาร', 'info');
            return;
        }

        let billHtml = `<div class="text-left text-sm max-h-60 overflow-y-auto">`;
        
        myActiveOrders.forEach(order => {
            order.items.forEach(item => {
                billHtml += `
                    <div class="flex justify-between py-1 border-b border-dashed border-gray-200">
                        <span>${item.quantity}x ${item.name}</span>
                        <span>${(item.finalPrice * item.quantity).toLocaleString()} ฿</span>
                    </div>
                `;
            });
        });
        
        billHtml += `</div>
            <div class="flex justify-between font-bold text-lg mt-4 pt-2 border-t border-black">
                <span>ยอดรวม</span>
                <span class="text-blue-600">${totalBillAmount.toLocaleString()} ฿</span>
            </div>
            <p class="text-xs text-gray-500 mt-2 text-center">กรุณาแจ้งพนักงานเพื่อชำระเงิน</p>
        `;

        Swal.fire({
            title: `รายการอาหาร โต๊ะ ${table.name}`,
            html: billHtml,
            showCloseButton: true,
            showConfirmButton: false
        });
    };

    // The function provided in the snippet, integrated here
    const handleSubmitOrder = async () => {
        if (cartItems.length === 0) return;

        const result = await Swal.fire({
            title: t('ยืนยันการสั่งอาหาร?'),
            text: `${t('สั่งอาหาร')} ${cartItems.reduce((sum, i) => sum + i.quantity, 0)} ${t('รายการ')}`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: t('สั่งเลย'),
            cancelButtonText: t('ตรวจสอบก่อน'),
            confirmButtonColor: '#10B981'
        });

        if (result.isConfirmed) {
            Swal.fire({ title: t('กำลังส่งรายการ...'), allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

            try {
                // CRITICAL FIX: Revert names to Thai and ensure no 'undefined' values before sending to backend.
                const itemsToSend = cartItems.map(cartItem => {
                    const originalItem = menuItems.find(m => m.id === cartItem.id);
                    return {
                        ...cartItem,
                        // Revert main name to original (Thai)
                        name: originalItem ? originalItem.name : cartItem.name,
                        // Safely revert english name, defaulting to empty string
                        nameEn: originalItem?.nameEn || '',
                        
                        // Also revert names within selected options
                        selectedOptions: cartItem.selectedOptions.map(opt => {
                            const originalGroup = originalItem?.optionGroups?.find(g => g.options.some(o => o.id === opt.id));
                            const originalOpt = originalGroup?.options.find(o => o.id === opt.id);
                            return {
                                ...opt,
                                name: originalOpt ? originalOpt.name : opt.name,
                                nameEn: originalOpt?.nameEn || '' // Safety fix for options
                            };
                        })
                    };
                });

                const newOrder = await onPlaceOrder(itemsToSend, customerName);
                if (newOrder) {
                    setMyOrderNumbers(prev => [...prev, newOrder.orderNumber]);
                    // Optimistic Update: Add new order to local state immediately
                    setOptimisticOrders(prev => [...prev, newOrder]);
                    
                    setCartItems([]);
                    setIsCartOpen(false);

                    // SHOW QUEUE NUMBER TO CUSTOMER
                    const orderNumDisplay = String(newOrder.orderNumber).padStart(2, '0');
                    await Swal.fire({ 
                        icon: 'success', 
                        title: t('สั่งอาหารสำเร็จ!'), 
                        html: `<div class="text-lg">${t('รายการอาหารถูกส่งเข้าครัวแล้ว')}</div><div class="mt-4 text-sm text-gray-500">${t('คิวที่')}</div><div class="text-5xl font-black text-blue-600 mt-1">#${orderNumDisplay}</div>`, 
                        timer: 4000, 
                        showConfirmButton: false 
                    });
                } else {
                     // Fallback if no order returned (should rarely happen)
                     setCartItems([]);
                     setIsCartOpen(false);
                     await Swal.fire({ icon: 'success', title: t('สั่งอาหารสำเร็จ!'), text: t('รายการอาหารถูกส่งเข้าครัวแล้ว'), timer: 2500, showConfirmButton: false });
                }

            } catch (error) {
                Swal.fire({ icon: 'error', title: t('เกิดข้อผิดพลาด'), text: t('ไม่สามารถสั่งอาหารได้ กรุณาลองใหม่อีกครั้ง') });
            }
        }
    };

    const cartTotal = cartItems.reduce((acc, item) => acc + (item.finalPrice * item.quantity), 0);

    return (
        <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
            {/* Header */}
            <header className="bg-white shadow-sm px-4 py-3 flex justify-between items-center z-10">
                <div className="flex items-center gap-3">
                    {logoUrl && <img src={logoUrl} alt="Logo" className="h-10 w-10 object-contain rounded-md" />}
                    <div>
                        <h1 className="font-bold text-gray-800 text-lg leading-none">{restaurantName}</h1>
                        <p className="text-sm text-gray-500 mt-0.5">โต๊ะ: {table.name}</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    {/* View Bill Button */}
                    {totalBillAmount > 0 && (
                        <button 
                            onClick={handleViewBill}
                            className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm border border-blue-100 active:bg-blue-100 flex flex-col items-end leading-none"
                        >
                            <span>฿{totalBillAmount.toLocaleString()}</span>
                            <span className="text-[10px] font-normal">{totalBillItemsCount} รายการ</span>
                        </button>
                    )}

                    <button onClick={handleStaffCallClick} className="bg-red-100 text-red-600 p-2 rounded-full shadow-sm active:bg-red-200">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                    </button>
                </div>
            </header>

            {/* Customer Name Input (Optional) */}
            <div className="bg-blue-50 px-4 py-2 border-b border-blue-100 flex items-center gap-2">
                <span className="text-sm text-blue-700 font-medium whitespace-nowrap">ชื่อของคุณ:</span>
                <input 
                    type="text" 
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="(ระบุชื่อเพื่อให้เสิร์ฟถูกต้อง)"
                    className="w-full bg-white border border-blue-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400 text-gray-700"
                />
            </div>

            {/* Categories */}
            <div className="bg-white border-b border-gray-100 py-2">
                <div className="flex overflow-x-auto gap-2 px-4 hide-scrollbar">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                                selectedCategory === cat 
                                    ? 'bg-blue-600 text-white shadow-md' 
                                    : 'bg-gray-100 text-gray-600'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Menu Grid */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-2 gap-4 pb-20">
                    {filteredItems.map(item => (
                        <div key={item.id} className="bg-white rounded-xl shadow-sm overflow-hidden flex flex-col h-full" onClick={() => handleAddToCart(item)}>
                            <div className="aspect-[4/3] bg-gray-200 relative">
                                <MenuItemImage src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                {recommendedMenuItemIds.includes(item.id) && (
                                    <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                                        แนะนำ
                                    </div>
                                )}
                            </div>
                            <div className="p-3 flex flex-col flex-1">
                                <h3 className="font-bold text-gray-800 text-sm line-clamp-2 mb-1">{item.name}</h3>
                                <div className="mt-auto flex justify-between items-center">
                                    <span className="text-blue-600 font-bold">{item.price.toLocaleString()} ฿</span>
                                    <button className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-lg leading-none">+</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Cart Summary Bar */}
            {cartItems.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent z-20">
                    <button 
                        onClick={() => setIsCartOpen(true)}
                        className="w-full bg-blue-600 text-white rounded-xl shadow-lg p-3 flex justify-between items-center animate-bounce-in"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-white text-blue-600 font-bold w-8 h-8 rounded-full flex items-center justify-center">
                                {cartItems.reduce((acc, i) => acc + i.quantity, 0)}
                            </div>
                            <span className="font-bold text-lg">ดูรายการอาหาร</span>
                        </div>
                        <span className="font-bold text-xl">{cartTotal.toLocaleString()} ฿</span>
                    </button>
                </div>
            )}

            {/* Cart Modal */}
            {isCartOpen && (
                <div className="fixed inset-0 z-50 bg-gray-900 bg-opacity-95 flex flex-col h-full animate-slide-up">
                    <div className="flex-1 overflow-y-auto p-4 pb-32">
                        <div className="flex justify-between items-center mb-6 text-white">
                            <h2 className="text-2xl font-bold">รายการที่เลือก</h2>
                            <button onClick={() => setIsCartOpen(false)} className="bg-gray-800 p-2 rounded-full text-gray-400 hover:text-white">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Customer Name Input in Cart */}
                        <div className="bg-gray-800 p-4 rounded-xl mb-4 border border-gray-700">
                            <label className="block text-gray-400 text-sm mb-2">ชื่อผู้สั่ง (Optional)</label>
                            <input 
                                type="text" 
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                placeholder="ใส่ชื่อเล่น..."
                                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>

                        {cartItems.map((item, idx) => (
                            <div key={idx} className="bg-gray-800 p-4 rounded-xl mb-3 flex justify-between items-start">
                                <div className="flex-1">
                                    <h4 className="text-white font-bold text-lg">{item.name}</h4>
                                    {item.selectedOptions.length > 0 && (
                                        <p className="text-gray-400 text-sm mt-1">{item.selectedOptions.map(o => o.name).join(', ')}</p>
                                    )}
                                    {item.notes && <p className="text-yellow-500 text-sm mt-1">Note: {item.notes}</p>}
                                    <p className="text-blue-400 font-bold mt-2">{item.finalPrice.toLocaleString()} ฿</p>
                                </div>
                                <div className="flex flex-col items-end gap-3">
                                    <button onClick={() => handleRemoveFromCart(item.cartItemId)} className="text-red-400 text-sm underline">ลบ</button>
                                    <span className="bg-gray-700 text-white px-3 py-1 rounded-lg font-bold">x{item.quantity}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-gray-800 border-t border-gray-700 p-4 absolute bottom-0 left-0 right-0">
                        <div className="flex justify-between items-center mb-4 text-white">
                            <span className="text-lg">ยอดรวม</span>
                            <span className="text-3xl font-bold">{cartTotal.toLocaleString()} ฿</span>
                        </div>
                        <button 
                            onClick={handleSubmitOrder}
                            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl text-xl shadow-lg transition-colors"
                        >
                            ยืนยันสั่งอาหาร
                        </button>
                    </div>
                </div>
            )}

            {/* Item Customization Modal */}
            {itemToCustomize && (
                <ItemCustomizationModal
                    isOpen={true}
                    onClose={() => setItemToCustomize(null)}
                    item={itemToCustomize}
                    onConfirm={handleConfirmCustomization}
                />
            )}
        </div>
    );
};
