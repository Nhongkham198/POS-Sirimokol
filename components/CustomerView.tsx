
import React, { useState, useMemo, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import type { Table, MenuItem, ActiveOrder, CompletedOrder, OrderItem } from '../types';
import { MenuItemImage } from './MenuItemImage';
import { ItemCustomizationModal } from './ItemCustomizationModal';
import { db } from '../firebaseConfig'; // Import db for direct listening

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
    
    // To track orders placed by this session
    const [myOrderNumbers, setMyOrderNumbers] = useState<number[]>([]);
    const [optimisticOrders, setOptimisticOrders] = useState<ActiveOrder[]>([]);

    // --- LOGIC: Sticky Thank You Screen Keys ---
    const STORAGE_KEY = `pos_thankyou_lock_table_${table.id}`;
    const CALL_COOLDOWN_KEY = `pos_call_cooldown_table_${table.id}`;

    // State for Sticky Thank You Screen - Initialize from localStorage to prevent flash on refresh
    const [isThankYouScreenVisible, setIsThankYouScreenVisible] = useState(() => {
        return !!localStorage.getItem(STORAGE_KEY);
    });
    
    // Cooldown State for Staff Call
    const [callCooldown, setCallCooldown] = useState(0);

    // Ref to ignore history checks only when manually starting a new session
    const ignoreHistoryRef = useRef(false);

    // Get Branch ID from URL for direct DB access
    const branchIdParam = useMemo(() => new URLSearchParams(window.location.search).get('branchId'), []);
    
    // Local state for latest completed order (Direct DB)
    const [latestCompletedOrder, setLatestCompletedOrder] = useState<CompletedOrder | null>(null);

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

    // 1. Initialize Call Cooldown on Mount
    useEffect(() => {
        const lastCallTime = localStorage.getItem(CALL_COOLDOWN_KEY);
        if (lastCallTime) {
            const timePassed = Date.now() - parseInt(lastCallTime, 10);
            const cooldownTime = 60000; // 60 seconds
            if (timePassed < cooldownTime) {
                setCallCooldown(Math.ceil((cooldownTime - timePassed) / 1000));
            }
        }
    }, [CALL_COOLDOWN_KEY]);

    // Timer for Cooldown
    useEffect(() => {
        if (callCooldown > 0) {
            const timer = setInterval(() => {
                setCallCooldown(prev => prev - 1);
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [callCooldown]);

    // 2. Direct Firestore Listener for Completed Orders (Fix for missing props data & Index Issues)
    useEffect(() => {
        if (!db || !branchIdParam || !table) return;

        // Query the latest 20 completed orders for the branch.
        // We do NOT filter by tableId in the query to avoid needing a composite index.
        // We filter in memory instead.
        const unsubscribe = db.collection(`branches/${branchIdParam}/completedOrders_v2`)
            .orderBy('completionTime', 'desc')
            .limit(20) 
            .onSnapshot((snapshot: any) => {
                if (!snapshot.empty) {
                    // Find the most recent order for THIS table
                    const found = snapshot.docs
                        .map((d: any) => d.data() as CompletedOrder)
                        .find((o: CompletedOrder) => o.tableId === table.id);
                    
                    if (found) {
                        setLatestCompletedOrder(found);
                    }
                }
            }, (error: any) => {
                console.warn("Error listening to completed orders:", error);
            });

        return () => unsubscribe();
    }, [branchIdParam, table.id]);

    // 3. Detect Payment Completion & Manage Lock State
    useEffect(() => {
        const hasActive = myActiveOrders.length > 0;
        
        if (hasActive) {
            // If active orders exist (Staff opened new bill or currently ordering), Unlock immediately
            if (isThankYouScreenVisible) {
                localStorage.removeItem(STORAGE_KEY);
                setIsThankYouScreenVisible(false);
                ignoreHistoryRef.current = false; // Reset ignore flag
            }
        } else {
            // No active orders. Check if we should lock.
            // Only check for completion if we haven't explicitly ignored history (via manual new session)
            if (!ignoreHistoryRef.current) {
                // Check if there is a completed order for this table in the last 5 minutes
                // Check both prop (if available) and direct listener
                const checkTimeWindow = 300000; // 5 minutes in ms

                const recentFromProp = completedOrders.find(o => 
                    o.tableId === table.id && 
                    (Date.now() - o.completionTime) < checkTimeWindow
                );
                
                let recentFromDirect = null;
                if (latestCompletedOrder && latestCompletedOrder.tableId === table.id) {
                     if ((Date.now() - latestCompletedOrder.completionTime) < checkTimeWindow) {
                         recentFromDirect = latestCompletedOrder;
                     }
                }

                const recentCompleted = recentFromProp || recentFromDirect;

                if (recentCompleted) {
                    // Set Sticky State if not already set
                    if (!isThankYouScreenVisible) {
                        localStorage.setItem(STORAGE_KEY, 'true');
                        setIsThankYouScreenVisible(true);
                        setCartItems([]); 
                    }
                } else {
                    // No active order AND No recent completed order (Time expired) -> Unlock
                    // Only unlock if we were previously locked. 
                    if (isThankYouScreenVisible) {
                        localStorage.removeItem(STORAGE_KEY);
                        setIsThankYouScreenVisible(false);
                    }
                }
            }
        }
    }, [myActiveOrders, completedOrders, latestCompletedOrder, table.id, isThankYouScreenVisible, STORAGE_KEY]);

    const handleNewSession = () => {
        // Manual override to start new order
        localStorage.removeItem(STORAGE_KEY);
        setIsThankYouScreenVisible(false);
        setCartItems([]);
        ignoreHistoryRef.current = true; // Prevent re-locking from history for this session
    };


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
        if (callCooldown > 0) return;

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
                
                // Set Cooldown
                const now = Date.now();
                localStorage.setItem(CALL_COOLDOWN_KEY, now.toString());
                setCallCooldown(60);

                Swal.fire({
                    icon: 'success',
                    title: 'เรียกพนักงานแล้ว',
                    text: 'กรุณารอสักครู่',
                    timer: 2000,
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
                // Prepare items correctly
                const itemsToSend = cartItems.map(cartItem => {
                    const originalItem = menuItems.find(m => m.id === cartItem.id);
                    return {
                        ...cartItem,
                        name: originalItem ? originalItem.name : cartItem.name,
                        nameEn: originalItem?.nameEn || '',
                        selectedOptions: cartItem.selectedOptions.map(opt => {
                            const originalGroup = originalItem?.optionGroups?.find(g => g.options.some(o => o.id === opt.id));
                            const originalOpt = originalGroup?.options.find(o => o.id === opt.id);
                            return {
                                ...opt,
                                name: originalOpt ? originalOpt.name : opt.name,
                                nameEn: originalOpt?.nameEn || ''
                            };
                        })
                    };
                });

                const newOrder = await onPlaceOrder(itemsToSend, customerName);
                if (newOrder) {
                    setMyOrderNumbers(prev => [...prev, newOrder.orderNumber]);
                    setOptimisticOrders(prev => [...prev, newOrder]);
                    
                    setCartItems([]);
                    setIsCartOpen(false);

                    const orderNumDisplay = String(newOrder.orderNumber).padStart(2, '0');
                    await Swal.fire({ 
                        icon: 'success', 
                        title: t('สั่งอาหารสำเร็จ!'), 
                        html: `<div class="text-lg">${t('รายการอาหารถูกส่งเข้าครัวแล้ว')}</div><div class="mt-4 text-sm text-gray-500">${t('คิวที่')}</div><div class="text-5xl font-black text-blue-600 mt-1">#${orderNumDisplay}</div>`, 
                        timer: 4000, 
                        showConfirmButton: false 
                    });
                } else {
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

    // --- RENDER: THANK YOU SCREEN (Sticky) ---
    if (isThankYouScreenVisible) {
        return (
            <div className="fixed inset-0 bg-white z-[9999] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-pop-in">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h1 className="text-3xl font-bold text-gray-800 mb-2">ขอบคุณที่ใช้บริการ</h1>
                <p className="text-lg text-gray-600 mb-2">การชำระเงินเสร็จสมบูรณ์</p>
                <p className="text-sm text-gray-400 mb-8">(หน้าจอจะค้างหน้านี้จนกว่าจะสแกนใหม่)</p>
                
                <div className="bg-gray-50 p-6 rounded-2xl w-full max-w-sm border border-gray-100 shadow-inner mb-10">
                    {logoUrl && <img src={logoUrl} alt="Logo" className="h-12 mx-auto mb-3 object-contain" />}
                    <p className="font-bold text-gray-800 text-lg">{restaurantName}</p>
                    <p className="text-sm text-gray-500 mt-1">หวังว่าจะได้ให้บริการท่านอีกครั้ง</p>
                </div>

                <div className="absolute bottom-10 w-full px-6 opacity-30 hover:opacity-100 transition-opacity">
                    <button 
                        onClick={handleNewSession}
                        className="text-gray-400 text-sm hover:text-gray-600 underline"
                    >
                        เริ่มรายการใหม่ (Manual Reset)
                    </button>
                </div>
            </div>
        );
    }

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

                    <button 
                        onClick={handleStaffCallClick} 
                        disabled={callCooldown > 0}
                        className={`p-2 rounded-full shadow-sm active:bg-red-200 transition-all relative ${callCooldown > 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-red-100 text-red-600'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        {callCooldown > 0 && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/10 rounded-full">
                                <span className="text-[10px] font-bold text-black">{callCooldown}</span>
                            </div>
                        )}
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
                {/* 
                    RESPONSIVE UPDATE:
                    - grid-cols-2: Default (Mobile)
                    - md:grid-cols-3: Tablet
                    - lg:grid-cols-4: Small Laptop
                    - xl:grid-cols-5: Desktop
                */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-20">
                    {filteredItems.map(item => (
                        <div key={item.id} className="bg-white rounded-xl shadow-sm overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow" onClick={() => handleAddToCart(item)}>
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
                                    <button className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-lg leading-none hover:bg-blue-200">+</button>
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
                        className="w-full bg-blue-600 text-white rounded-xl shadow-lg p-3 flex justify-between items-center animate-bounce-in max-w-xl mx-auto"
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
                        <div className="flex justify-between items-center mb-6 text-white max-w-2xl mx-auto w-full">
                            <h2 className="text-2xl font-bold">รายการที่เลือก</h2>
                            <button onClick={() => setIsCartOpen(false)} className="bg-gray-800 p-2 rounded-full text-gray-400 hover:text-white">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="max-w-2xl mx-auto w-full">
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
                    </div>

                    <div className="bg-gray-800 border-t border-gray-700 p-4 absolute bottom-0 left-0 right-0">
                        <div className="max-w-2xl mx-auto w-full">
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
