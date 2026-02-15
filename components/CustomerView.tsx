
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { MenuItem, Table, OrderItem, ActiveOrder, StaffCall, CompletedOrder } from '../types';
import { Menu } from './Menu';
import { ItemCustomizationModal } from './ItemCustomizationModal';
import Swal from 'sweetalert2';

declare var html2canvas: any;

// ... (KEEP DICTIONARY CONSTANTS AS IS - NO CHANGE)
// ... existing code ...
const RAW_DICTIONARY: Record<string, string> = {
    // UI Elements
    'เมนูอาหาร 🍽️': 'Menu 🍽️',
    'เมนูอาหาร': 'Menu', 
    'ค้นหาเมนู...': 'Search menu...', // Added for search placeholder
    'โต๊ะ': 'Table',
    'คุณ': 'Guest: ',
    'เรียกพนักงาน': 'Call Staff',
    'เรียก': 'Call',
    'ยอดของฉัน': 'My Total',
    'ดูตะกร้า': 'View Cart',
    'ยังไม่รวมกับยอดบิล': 'Not ordered yet',
    'รายการในตะกร้า (ยังไม่สั่ง)': 'Cart (Not Ordered)',
    'ไม่มีสินค้าในตะกร้า': 'Cart is empty',
    'ยอดในตะกร้า': 'Cart Total',
    'ยืนยันสั่งอาหาร 🚀': 'Confirm Order 🚀',
    'ลบ': 'Remove',
    'บันทึกรายการของฉัน': 'Save My Items',
    'ปิด': 'Close',
    'รายการของฉัน': 'My Orders',
    'ยังไม่มีรายการที่สั่ง': 'No orders yet',
    'รายการของคุณ': 'Your Items',
    'รายการของเพื่อนร่วมโต๊ะ': 'Table Items',
    'ยอดรวมทั้งโต๊ะ': 'Table Total',
    '* ราคานี้เป็นเฉพาะรายการที่คุณสั่ง': '* Price for your items only',
    'ยืนยันการสั่งอาหาร?': 'Confirm Order?',
    'สั่งอาหาร': 'Order',
    'รายการ': 'items',
    'สั่งเลย': 'Order Now',
    'ตรวจสอบก่อน': 'Check First',
    'กำลังส่งรายการ...': 'Sending order...',
    'สั่งอาหารสำเร็จ!': 'Order Success!',
    'รายการอาหารถูกส่งเข้าครัวแล้ว': 'Your order has been sent to the kitchen',
    'เกิดข้อผิดพลาด': 'Error',
    'ไม่สามารถสั่งอาหารได้ กรุณาลองใหม่อีกครั้ง': 'Cannot place order. Please try again.',
    'ส่งสัญญาณเรียกพนักงานแล้ว': 'Staff called',
    'กรุณารอสักครู่...': 'Please wait...',
    'กำลังสร้างรูปภาพ...': 'Generating image...',
    'กรุณารอสักครู่': 'Please wait',
    'ไม่สามารถสร้างรูปภาพได้': 'Cannot generate image',
    'เพิ่มลงตะกร้าแล้ว': 'Added to cart',
    'รอคิว': 'Waiting',
    'กำลังปรุง... 🍳': 'Cooking... 🍳',
    'เสิร์ฟครบแล้ว 😋': 'Served 😋',
    'คิวที่ 1': '1st Queue',
    'อีก': 'More',
    'คิว': 'Queues',
    'บันทึกสำเร็จ!': 'Saved!',
    'ขอบคุณที่ใช้บริการ...': 'Thank you...',
    'ไม่สามารถบันทึกบิลได้': 'Cannot save bill',
    'ไม่ระบุชื่อ': 'Anonymous',
    'ราคาเริ่มต้น': 'Starts at',
    'หมายเหตุ (ถ้ามี):': 'Note (Optional):',
    'รับเครื่องใช้': 'Cutlery',
    'รับช้อนส้อม': 'Spoon & Fork',
    'รับตะเกียบ': 'Chopsticks',
    'อื่นๆ (ระบุ)': 'Other (Specify)',
    'ไม่รับ': 'No Cutlery',
    'สั่งกลับบ้าน': 'Take Away',
    'เพิ่มOrder': 'Add to Cart',
    'บันทึกการแก้ไข': 'Save Changes',
    'ล้างที่เลือก': 'Clear',
    'จำนวน': 'Qty',
    'ออกจากระบบ': 'Logout',
    'ยืนยันการออกจากระบบ': 'Confirm Logout',
    'คุณต้องการออกจากระบบใช่หรือไม่?': 'Are you sure you want to logout?',
    'ใช่': 'Yes',
    'ยกเลิก': 'Cancel',
    
    // Categories
    'ทั้งหมด': 'All',
    'อาหารจานเดียว': 'A La Carte',
    'อาหารเกาหลี': 'Korean Food',
    'ของทานเล่น': 'Appetizers',
    'เครื่องดื่ม': 'Drinks',
    'เมนู ซุป': 'Soup Menu',
    'เมนู ข้าว': 'Rice Menu',
    'เมนู เส้น': 'Noodle Menu',
    'อาหารจานหลัก': 'Main Course',
    'เมนู ทานเล่น': 'Snacks',
    'เมนู เซต': 'Set Menu',
    // Add specific known variations just in case
    'เมนูข้าว': 'Rice Menu',
    'เมนูซุป': 'Soup Menu',
    'เมนูเส้น': 'Noodle Menu',
    'เมนูเซต': 'Set Menu',
    'เมนูทานเล่น': 'Snacks'
};

// ... (KEEP NORMALIZED_DICTIONARY AS IS)
const NORMALIZED_DICTIONARY = Object.keys(RAW_DICTIONARY).reduce((acc, key) => {
    // Remove all whitespace from the key
    const normalizedKey = key.replace(/\s+/g, '');
    acc[normalizedKey] = RAW_DICTIONARY[key];
    return acc;
}, {} as Record<string, string>);

interface CustomerViewProps {
    table: Table;
    menuItems: MenuItem[];
    categories: string[];
    activeOrders: ActiveOrder[];
    allBranchOrders: ActiveOrder[]; 
    completedOrders: CompletedOrder[];
    onPlaceOrder: (items: OrderItem[], customerName: string) => Promise<number | void | undefined>;
    onStaffCall: (table: Table, customerName: string) => void;
    recommendedMenuItemIds: number[];
    logoUrl: string | null;
    restaurantName: string;
    onLogout?: () => void; // Added onLogout prop
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
    restaurantName,
    onLogout
}) => {
    // ... (Keep existing state hooks)
    const [lang, setLang] = useState<'TH' | 'EN'>('TH');

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [customerName, setCustomerName] = useState('ลูกค้า'); 
    
    const [isSessionCompleted, setIsSessionCompleted] = useState(() => {
        return sessionStorage.getItem(`customer_completed_${table.id}`) === 'true';
    });

    // --- NEW: Loading Screen State ---
    // Update logic: Check sessionStorage to skip loading on refresh
    const [isLoadingScreen, setIsLoadingScreen] = useState(() => {
        // If session is completed, no loading needed
        if (sessionStorage.getItem(`customer_completed_${table.id}`) === 'true') return false;
        // If flag 'has_seen_loading' exists for this table, skip loading
        if (sessionStorage.getItem(`has_seen_loading_${table.id}`)) return false;
        // Otherwise show loading
        return true;
    });
    const [loadingProgress, setLoadingProgress] = useState(0);

    // --- NEW: Loading Logic (Updated for 12 Seconds & No Repeat on Refresh) ---
    useEffect(() => {
        // If not showing loading screen, do nothing
        if (!isLoadingScreen) return;

        // Logic: 100% / 12 seconds = 8.33% per second
        // Or simpler: Update every 120ms, increment by 1%. 
        // 100 steps * 120ms = 12,000ms = 12 seconds.
        const interval = setInterval(() => {
            setLoadingProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(interval);
                    return 100;
                }
                return prev + 1; // Increment exactly 1% per tick
            });
        }, 120); // 120ms * 100 steps = 12 seconds

        if (loadingProgress === 100) {
            // Small delay to let user see 100% before hiding
            setTimeout(() => {
                setIsLoadingScreen(false);
                // Mark as seen in session storage
                sessionStorage.setItem(`has_seen_loading_${table.id}`, 'true');
            }, 500); 
        }

        return () => clearInterval(interval);
    }, [isLoadingScreen, loadingProgress, table.id]);

    // ... (Keep cart and order state hooks)
    const cartKey = `customer_cart_${table.id}`;
    const [cartItems, setCartItems] = useState<OrderItem[]>(() => {
        const savedCart = localStorage.getItem(cartKey);
        try {
            return savedCart ? JSON.parse(savedCart) : [];
        } catch (e) {
            console.error(`Error parsing cart for table ${table.id}`, e);
            localStorage.removeItem(cartKey);
            return [];
        }
    });

    const myOrdersKey = `customer_my_orders_${table.id}`;
    const [myOrderNumbers, setMyOrderNumbers] = useState<number[]>(() => {
        const saved = localStorage.getItem(myOrdersKey);
        try {
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    // ... (Keep translation helper)
    const t = useCallback((text: string) => {
        if (lang === 'TH') return text;
        if (!text || typeof text !== 'string') return text;
        
        // 1. Try exact match first (optimization)
        if (RAW_DICTIONARY[text]) return RAW_DICTIONARY[text];

        // 2. Try trimmed match
        const trimmed = text.trim();
        if (RAW_DICTIONARY[trimmed]) return RAW_DICTIONARY[trimmed];

        // 3. Try space-insensitive match (remove all spaces)
        const normalized = text.replace(/\s+/g, '');
        return NORMALIZED_DICTIONARY[normalized] || text;
    }, [lang]);

    // ... (Keep memoized localized data)
    const localizedCategories = useMemo(() => {
        return categories.map(c => t(c));
    }, [categories, t]);

    const localizedMenuItems = useMemo(() => {
        return menuItems.map(item => ({
            ...item,
            name: lang === 'EN' ? (item.nameEn || item.name) : item.name,
            category: t(item.category), // Translate item category to match category list
            optionGroups: item.optionGroups?.map(group => ({
                ...group,
                name: lang === 'EN' ? (group.nameEn || group.name) : group.name,
                options: (group.options || []).map(opt => ({
                    ...opt,
                    name: lang === 'EN' ? (opt.nameEn || opt.name) : opt.name
                }))
            }))
        }));
    }, [menuItems, lang, t]);

    // ... (Keep effects for persistence)
    useEffect(() => {
        localStorage.setItem(cartKey, JSON.stringify(cartItems));
    }, [cartItems, cartKey]);

    useEffect(() => {
        localStorage.setItem(myOrdersKey, JSON.stringify(myOrderNumbers));
    }, [myOrderNumbers, myOrdersKey]);

    // ... (Keep UI state)
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isActiveOrderListOpen, setIsActiveOrderListOpen] = useState(false);
    const [itemToCustomize, setItemToCustomize] = useState<MenuItem | null>(null);
    const billContentRef = useRef<HTMLDivElement>(null);
    
    const prevMyItemsCountRef = useRef<number>(0);
    const isProcessingPaymentRef = useRef(false);
    
    // ... (Keep Session Logic)
    useEffect(() => {
        if (isSessionCompleted) return;

        const sessionKey = `customer_session_${table.id}`;
        const savedSession = localStorage.getItem(sessionKey);
        
        if (savedSession) {
            try {
                const { name } = JSON.parse(savedSession);
                setCustomerName(name || 'ลูกค้า');
                setIsAuthenticated(true);
            } catch (e) {
                initializeSession(sessionKey);
            }
        } else {
            initializeSession(sessionKey);
        }
    }, [table.id, isSessionCompleted]);

    const initializeSession = (sessionKey: string) => {
        const randomSuffix = Math.floor(Math.random() * 1000);
        const name = `Guest-${randomSuffix}`;
        localStorage.setItem(sessionKey, JSON.stringify({ name }));
        setCustomerName(name);
        setIsAuthenticated(true);
    };

    const handlePaymentCompleteLock = () => {
        localStorage.removeItem(cartKey);
        localStorage.removeItem(myOrdersKey);
        sessionStorage.setItem(`customer_completed_${table.id}`, 'true');
        setIsSessionCompleted(true);
    };

    // --- NEW: Real-time Table Move Detection ---
    useEffect(() => {
        // Only run if we have active orders and aren't already completed
        if (myOrderNumbers.length === 0 || isSessionCompleted) return;

        // Check if any of "my orders" are currently active at a DIFFERENT table
        // We use allBranchOrders to scan the entire restaurant state
        const movedOrder = allBranchOrders.find(o =>
            // 1. Order belongs to this device (by ID) OR merged into this device's order
            (myOrderNumbers.includes(o.orderNumber) || (o.mergedOrderNumbers && o.mergedOrderNumbers.some(n => myOrderNumbers.includes(n)))) &&
            // 2. Order is active (not completed/cancelled)
            o.status !== 'completed' &&
            o.status !== 'cancelled' &&
            // 3. Table ID in database is DIFFERENT from the current page's table ID
            o.tableId !== table.id &&
            // 4. Ensure it's a valid table (not a placeholder like -99 for delivery)
            o.tableId > 0
        );

        if (movedOrder) {
            // Found a move!
            console.log(`[Auto-Follow] Order moved to Table ${movedOrder.tableId}. Redirecting...`);

            const newTableId = movedOrder.tableId;

            // 1. Construct the new URL
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set('tableId', String(newTableId));

            // 2. MIGRATE LOCAL STORAGE DATA to the new Table ID
            // This ensures the customer keeps their session name, cart, and order history
            
            // Migrate Session Name
            const oldSessionKey = `customer_session_${table.id}`;
            const newSessionKey = `customer_session_${newTableId}`;
            const sessionData = localStorage.getItem(oldSessionKey);
            if (sessionData && !localStorage.getItem(newSessionKey)) {
                localStorage.setItem(newSessionKey, sessionData);
            }

            // Migrate My Orders List
            const oldOrdersKey = `customer_my_orders_${table.id}`;
            const newOrdersKey = `customer_my_orders_${newTableId}`;
            const ordersData = localStorage.getItem(oldOrdersKey);
            if (ordersData) {
                // Merge if target exists, otherwise set
                const existing = JSON.parse(localStorage.getItem(newOrdersKey) || '[]');
                const old = JSON.parse(ordersData);
                const combined = [...new Set([...existing, ...old])];
                localStorage.setItem(newOrdersKey, JSON.stringify(combined));
            }

            // Migrate Cart (Optional but good UX)
            const oldCartKey = `customer_cart_${table.id}`;
            const newCartKey = `customer_cart_${newTableId}`;
            const cartData = localStorage.getItem(oldCartKey);
            if (cartData && !localStorage.getItem(newCartKey)) {
                localStorage.setItem(newCartKey, cartData);
            }

            // 3. Force Redirect to the new URL (Reloads page with new context)
            window.location.replace(currentUrl.toString());
        }
    }, [allBranchOrders, myOrderNumbers, table.id, isSessionCompleted]);
    // -------------------------------------------

    // ... (Keep Identify Items Logic)
    const { myItems, otherItems } = useMemo(() => {
        const mine: OrderItem[] = [];
        const others: { item: OrderItem, owner: string }[] = [];
        const myOrderSet = new Set(myOrderNumbers);
        const currentNormName = customerName?.trim().toLowerCase();

        const tableOrders = Array.isArray(allBranchOrders) 
            ? allBranchOrders.filter(o => String(o.tableId) === String(table.id) && o.status !== 'cancelled' && o.status !== 'completed')
            : [];

        tableOrders.forEach(order => {
            const orderName = order.customerName || t('ไม่ระบุชื่อ');
            const orderNormName = order.customerName?.trim().toLowerCase();
            const isMyOrderByName = isAuthenticated && currentNormName && orderNormName === currentNormName;

            order.items.forEach(item => {
                const originId = item.originalOrderNumber ?? order.orderNumber;
                const isMyItemById = myOrderSet.has(originId);

                // Find original item to get Name EN if needed
                const originalItem = menuItems.find(m => m.id === item.id);
                
                const displayItem = {
                    ...item,
                    name: lang === 'EN' ? (originalItem?.nameEn || item.name) : item.name,
                    selectedOptions: item.selectedOptions.map(opt => ({
                        ...opt,
                        name: lang === 'EN' ? (opt.nameEn || opt.name) : opt.name
                    }))
                };

                if (isMyItemById || isMyOrderByName) {
                    mine.push(displayItem);
                } else {
                    others.push({ item: displayItem, owner: orderName });
                }
            });
        });

        return { myItems: mine, otherItems: others };
    }, [allBranchOrders, myOrderNumbers, isAuthenticated, customerName, table.id, lang, menuItems, t]);

    const myTotal = useMemo(() => {
        return myItems.reduce((sum, item) => sum + (item.finalPrice * item.quantity), 0);
    }, [myItems]);

    const grandTotal = myTotal + otherItems.reduce((sum, { item }) => sum + (item.finalPrice * item.quantity), 0);

    // ... (Keep update myOrderNumbers effect)
    useEffect(() => {
        if (!isAuthenticated || !customerName) return;
        try {
            const currentNormName = customerName.trim().toLowerCase();
            const newMyOrderIds: number[] = [];
            activeOrders.forEach(order => {
                const orderNormName = order.customerName?.trim().toLowerCase();
                if (order && orderNormName === currentNormName && !myOrderNumbers.includes(order.orderNumber)) {
                    newMyOrderIds.push(order.orderNumber);
                }
            });
            if (newMyOrderIds.length > 0) {
                setMyOrderNumbers(prev => [...prev, ...newMyOrderIds]);
            }
        } catch (e) {
            console.error("Error updating myOrderNumbers:", e);
        }
    }, [activeOrders, customerName, isAuthenticated, myOrderNumbers]);


    // ... (Keep Payment Detect Effect - No changes)
    useEffect(() => {
        if (!isAuthenticated || isSessionCompleted) return;
    
        const currentCount = myItems.length;
        const prevCount = prevMyItemsCountRef.current;
        const isTransitioning = prevCount > 0 && currentCount === 0;
        
        if (isTransitioning || (isProcessingPaymentRef.current && currentCount === 0)) {
            isProcessingPaymentRef.current = true;
    
            const myJustCompletedOrders = completedOrders.filter(o =>
                myOrderNumbers.some(myNum =>
                    o.orderNumber === myNum || (o.mergedOrderNumbers && o.mergedOrderNumbers.includes(myNum))
                )
            );
    
            if (myJustCompletedOrders.length === 0) return; 

            const latestCompletedOrder = myJustCompletedOrders.sort((a, b) => b.completionTime - a.completionTime)[0];
            const processedKey = `processed_complete_${latestCompletedOrder.id}`;
            if (sessionStorage.getItem(processedKey)) return;
            sessionStorage.setItem(processedKey, 'true');
    
            const subtotal = latestCompletedOrder.items.reduce((sum, item) => sum + item.finalPrice * item.quantity, 0);
            const total = subtotal + latestCompletedOrder.taxAmount;
    
            const billHtml = `
                <div id="customer-final-bill" class="text-left p-4 bg-white font-sans text-black">
                    ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="mx-auto h-20 w-auto object-contain mb-4" crossOrigin="anonymous" />` : ''}
                    <h3 class="text-center text-xl font-bold mb-2">${restaurantName}</h3>
                    <p class="text-center text-xs text-gray-500 mb-4">ใบเสร็จรับเงิน (อย่างย่อ)</p>
                    <div class="text-sm space-y-1 mb-4">
                        <p><strong>โต๊ะ:</strong> ${latestCompletedOrder.tableName} (${latestCompletedOrder.floor})</p>
                        <p><strong>ลูกค้า:</strong> ${customerName}</p>
                        <p><strong>วันที่:</strong> ${new Date(latestCompletedOrder.completionTime).toLocaleString('th-TH')}</p>
                    </div>
                    <div class="border-t border-b border-dashed border-gray-400 py-2 my-2 space-y-1 text-sm">
                        ${latestCompletedOrder.items.map(item => `
                            <div class="flex justify-between">
                                <span class="pr-2">${item.quantity}x ${item.name}</span>
                                <span>${(item.finalPrice * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="text-sm space-y-1 mt-4">
                         <div class="flex justify-between">
                            <span>ยอดรวม</span>
                            <span>${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} ฿</span>
                        </div>
                        ${latestCompletedOrder.taxAmount > 0 ? `
                        <div class="flex justify-between">
                            <span>ภาษี (${latestCompletedOrder.taxRate}%)</span>
                            <span>${latestCompletedOrder.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ฿</span>
                        </div>
                        ` : ''}
                        <div class="flex justify-between font-bold text-base mt-2 pt-2 border-t border-gray-400">
                            <span>ยอดสุทธิ</span>
                            <span>${total.toLocaleString(undefined, { minimumFractionDigits: 2 })} ฿</span>
                        </div>
                    </div>
                    <p class="text-center text-sm font-semibold mt-6">ขอบคุณที่มาอุดหนุนร้านเรานะคะ 🙏</p>
                </div>
            `;
    
            Swal.fire({
                title: 'ชำระเงินเรียบร้อย!',
                html: `<div class="max-h-60 overflow-y-auto border rounded-lg">${billHtml}</div><p class="mt-4 text-sm text-red-500 font-bold">ระบบจะปิดอัตโนมัติใน 15 วินาที...</p>`,
                icon: 'success',
                showDenyButton: true,
                confirmButtonText: 'บันทึกบิล & ออก',
                denyButtonText: 'ไม่บันทึก & ออก',
                confirmButtonColor: '#3085d6',
                denyButtonColor: '#aaa',
                allowOutsideClick: false,
                timer: 15000, 
                timerProgressBar: true,
                preConfirm: async () => {
                    const billElement = document.getElementById('customer-final-bill');
                    if (billElement) {
                        try {
                            const canvas = await html2canvas(billElement, { scale: 2, useCORS: true });
                            return canvas.toDataURL('image/png');
                        } catch (err) {
                            return null;
                        }
                    }
                    return null;
                }
            }).then((result) => {
                if (result.isConfirmed && result.value) {
                    const link = document.createElement('a');
                    link.href = result.value;
                    link.download = `bill-${latestCompletedOrder.tableName}-${customerName}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
                handlePaymentCompleteLock();
            });
            
            isProcessingPaymentRef.current = false;
            prevMyItemsCountRef.current = 0;
            return;
        }
    
        isProcessingPaymentRef.current = false;
        prevMyItemsCountRef.current = currentCount;

    }, [myItems.length, isAuthenticated, completedOrders, myOrderNumbers, logoUrl, restaurantName, customerName, isSessionCompleted, t]);
    

    // ... (Keep handleSelectItem and other handlers)
    const handleSelectItem = (item: MenuItem) => {
        setItemToCustomize(item);
    };

    const handleConfirmCustomization = (itemToAdd: OrderItem) => {
        setCartItems(prev => {
            const existingItem = prev.find(i => i.cartItemId === itemToAdd.cartItemId);
            if (existingItem) {
                return prev.map(i => i.cartItemId === itemToAdd.cartItemId ? { ...i, quantity: i.quantity + itemToAdd.quantity } : i);
            }
            return [...prev, itemToAdd];
        });
        setItemToCustomize(null);
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: t('เพิ่มลงตะกร้าแล้ว'), showConfirmButton: false, timer: 1500 });
    };

    const handleRemoveItem = (cartItemId: string) => {
        setCartItems(prev => prev.filter(i => i.cartItemId !== cartItemId));
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
                // Revert names to Thai for backend
                const itemsToSend = cartItems.map(cartItem => {
                    const originalItem = menuItems.find(m => m.id === cartItem.id);
                    return {
                        ...cartItem,
                        name: originalItem ? originalItem.name : cartItem.name, 
                        nameEn: originalItem?.nameEn, 
                        selectedOptions: cartItem.selectedOptions.map(opt => {
                            const originalGroup = originalItem?.optionGroups?.find(g => g.options.some(o => o.id === opt.id));
                            const originalOpt = originalGroup?.options.find(o => o.id === opt.id);
                            return { ...opt, name: originalOpt ? originalOpt.name : opt.name };
                        })
                    };
                });

                const newOrderNumber = await onPlaceOrder(itemsToSend, customerName);
                if (newOrderNumber) {
                    setMyOrderNumbers(prev => [...prev, newOrderNumber]);
                }
                
                setCartItems([]);
                setIsCartOpen(false);

                await Swal.fire({ icon: 'success', title: t('สั่งอาหารสำเร็จ!'), text: t('รายการอาหารถูกส่งเข้าครัวแล้ว'), timer: 2500, showConfirmButton: false });

            } catch (error) {
                Swal.fire({ icon: 'error', title: t('เกิดข้อผิดพลาด'), text: t('ไม่สามารถสั่งอาหารได้ กรุณาลองใหม่อีกครั้ง') });
            }
        }
    };

    const handleCallStaffClick = () => {
        onStaffCall(table, customerName);
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: t('ส่งสัญญาณเรียกพนักงานแล้ว'), text: t('กรุณารอสักครู่...'), showConfirmButton: false, timer: 3000 });
    };

    const handleSaveBillAsImage = async () => {
        if (!billContentRef.current) return;
        Swal.fire({ title: t('กำลังสร้างรูปภาพ...'), text: t('กรุณารอสักครู่'), allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
        try {
            const canvas = await html2canvas(billContentRef.current, { scale: 2, useCORS: true });
            const image = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = image;
            link.download = `bill-table-${table.name}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            Swal.close();
        } catch (error) {
            Swal.fire({ icon: 'error', title: t('เกิดข้อผิดพลาด'), text: t('ไม่สามารถสร้างรูปภาพได้') });
        }
    };

    const handleLogoutClick = () => {
        if (onLogout) {
            Swal.fire({
                title: t('ยืนยันการออกจากระบบ'),
                text: t('คุณต้องการออกจากระบบใช่หรือไม่?'),
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                confirmButtonText: t('ใช่'),
                cancelButtonText: t('ยกเลิก')
            }).then((result) => {
                if (result.isConfirmed) {
                    onLogout();
                }
            });
        }
    };

    const cartTotalAmount = useMemo(() => cartItems.reduce((sum, i) => sum + (i.finalPrice * i.quantity), 0), [cartItems]);
    const totalCartItemsCount = useMemo(() => cartItems.reduce((sum, i) => sum + i.quantity, 0), [cartItems]);

    // ... (Keep Order Status Logic)
    const orderStatus = useMemo(() => {
        try {
            if (myItems.length === 0) return null;
            if (!Array.isArray(allBranchOrders)) return null;

            const myTableOrders = allBranchOrders.filter(o => String(o.tableId) === String(table.id));
            if (myTableOrders.length === 0) return { text: t('รอคิว'), color: 'bg-blue-600 text-white border-blue-700' };

            if (myTableOrders.some(o => o.status === 'cooking')) return { text: t('กำลังปรุง... 🍳'), color: 'bg-orange-500 text-white border-orange-600' };

            const waitingOrders = myTableOrders.filter(o => o.status === 'waiting');
            if (waitingOrders.length > 0) {
                const myEarliestOrderTime = Math.min(...waitingOrders.map(o => o.orderTime));
                const queueCount = allBranchOrders.filter(o => (o.status === 'waiting' || o.status === 'cooking') && o.orderTime < myEarliestOrderTime).length;
                if (queueCount === 0) return { text: `${t('รอคิว')} (${t('คิวที่ 1')} ☝️)`, color: 'bg-blue-600 text-white border-blue-700' };
                return { text: `${t('รอคิว...')} (${t('อีก')} ${queueCount} ${t('คิว')}) ⏳`, color: 'bg-blue-600 text-white border-blue-700' };
            }

            if (myTableOrders.every(o => o.status === 'served')) return { text: t('เสิร์ฟครบแล้ว 😋'), color: 'bg-green-500 text-white border-green-600' };

            return { text: t('รอคิว'), color: 'bg-blue-600 text-white border-blue-700' };
        } catch (e) {
            return myItems.length > 0 ? { text: t('รอคิว'), color: 'bg-blue-600 text-white border-blue-700' } : null;
        }
    }, [allBranchOrders, isAuthenticated, table.id, myItems.length, t]);

    // --- Loading Screen Render (MODIFIED) ---
    if (isLoadingScreen) {
        return (
            <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center animate-fade-in font-sans">
                {/* Logo or Name Section */}
                <div className="mb-10 relative flex justify-center items-center p-6">
                    <div className="relative">
                        {/* Subtle Glow/Shimmer behind logo */}
                        <div className="absolute inset-0 bg-gray-200 rounded-full blur-2xl opacity-40 animate-pulse"></div>
                        {logoUrl ? (
                            <img
                                src={logoUrl}
                                alt="Restaurant Logo"
                                className="w-48 h-48 object-contain relative z-10 drop-shadow-xl"
                                crossOrigin="anonymous"
                            />
                        ) : (
                            // Placeholder that waits for the logo, instead of showing text.
                            // This creates a "loading" state for the logo area itself.
                             <div className="w-48 h-48 object-contain relative z-10 shimmer-effect rounded-lg"></div>
                        )}
                    </div>
                </div>

                {/* Text */}
                <div className="text-center space-y-2 mb-8">
                    <h2 className="text-lg font-medium text-gray-600 tracking-wide font-sarabun">กำลังเตรียมความอร่อย...</h2>
                    <p className="text-gray-400 text-xs font-sarabun uppercase tracking-[0.2em]">Please wait</p>
                </div>

                {/* Sleek Progress Bar */}
                <div className="w-48 h-1 bg-gray-100 rounded-full overflow-hidden relative">
                    <div
                        className="h-full bg-gray-800 rounded-full transition-all duration-100 ease-out shadow-[0_0_10px_rgba(0,0,0,0.2)]"
                        style={{ width: `${loadingProgress}%` }}
                    >
                    </div>
                </div>

                {/* Percentage Text */}
                <p className="mt-3 text-gray-400 font-mono text-xs font-semibold">{loadingProgress}%</p>
            </div>
        );
    }
    
    if (isSessionCompleted) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                {/* ... (Keep session completed view) ... */}
                 <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-sm border-t-8 border-green-500">
                    <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">{restaurantName}</h2>
                    <h3 className="text-xl font-semibold text-gray-700 mb-4">{t('ขอบคุณที่ใช้บริการ')}</h3>
                    <div className="space-y-2 text-gray-500 text-sm mb-8">
                        <p>การชำระเงินของคุณเสร็จสมบูรณ์แล้ว</p>
                        <p>หวังว่าคุณจะมีความสุขกับมื้ออาหาร</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-blue-800 text-sm">
                        <p className="font-semibold mb-1">ต้องการสั่งอาหารเพิ่ม?</p>
                        <p className="opacity-80">กรุณาสแกน QR Code ที่โต๊ะใหม่อีกครั้ง</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-600">กำลังเข้าสู่ระบบ...</p>
            </div>
        );
    }

    // --- MAIN RENDER ---
    return (
        <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
            <header className="bg-white shadow-md z-30 relative">
                <div className="flex justify-between items-center px-4 py-2 border-b border-gray-100 bg-gray-50/50">
                    <h1 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                        {t('เมนูอาหาร 🍽️')}
                    </h1>
                    <div className="flex items-center gap-3">
                         <div className="flex bg-gray-200 rounded-lg p-1">
                            <button onClick={() => setLang('TH')} className={`px-3 py-1 rounded-md text-sm font-bold transition-all ${lang === 'TH' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>🇹🇭 TH</button>
                            <button onClick={() => setLang('EN')} className={`px-3 py-1 rounded-md text-sm font-bold transition-all ${lang === 'EN' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>🇬🇧 EN</button>
                        </div>
                        {onLogout && (
                            <button 
                                onClick={handleLogoutClick}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
                                title={t('ออกจากระบบ')}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                <div className="px-4 py-3 flex justify-between items-start">
                    {/* ... (Keep existing header content) ... */}
                    <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-full border border-gray-200 whitespace-nowrap">
                                {t('โต๊ะ')} <span className="text-gray-900 font-bold">{table.name} ({table.floor})</span>
                            </span>
                            {orderStatus && (
                                <span className={`text-xs font-bold px-3 py-1 rounded-full border shadow-sm ${orderStatus.color} whitespace-nowrap flex items-center gap-1 z-10`}>
                                    {orderStatus.text}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-400 pl-1">{t('คุณ')}{customerName}</p>
                    </div>

                    <div className="flex items-start gap-2 flex-shrink-0">
                        <button onClick={handleCallStaffClick} className="flex flex-col items-center justify-center p-2 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg shadow-sm hover:bg-yellow-100 transition-colors" title={t('เรียกพนักงาน')}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg>
                            <span className="text-[10px] font-bold mt-0.5">{t('เรียก')}</span>
                        </button>
                        <div className="flex flex-col items-end gap-1 cursor-pointer hover:opacity-80 transition-opacity group bg-white p-1 rounded" onClick={() => setIsActiveOrderListOpen(true)}>
                            <div className="text-right">
                                <div className="flex items-center justify-end gap-1 text-gray-400 text-[10px]">
                                    <span>{t('ยอดของฉัน')}</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <div className="flex items-center gap-1 justify-end">
                                    <span className="text-base font-bold text-blue-600 leading-none border-b border-dashed border-blue-300 group-hover:text-blue-700 transition-colors">{myTotal.toLocaleString()} ฿</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>
            
            <div className="flex-1 overflow-hidden relative">
                <Menu 
                    menuItems={localizedMenuItems}
                    setMenuItems={() => {}}
                    categories={localizedCategories}
                    onSelectItem={handleSelectItem}
                    isEditMode={false}
                    onEditItem={() => {}}
                    onAddNewItem={() => {}}
                    onDeleteItem={() => {}}
                    onUpdateCategory={() => {}}
                    onDeleteCategory={() => {}}
                    onAddCategory={() => {}}
                    onImportMenu={() => {}}
                    recommendedMenuItemIds={recommendedMenuItemIds}
                    hideCategories={true}
                    title={t('เมนูอาหาร')} // NEW: Pass localized title
                    searchPlaceholder={t('ค้นหาเมนู...')} // NEW: Pass localized placeholder
                />
            </div>

            {/* Float Cart Button */}
            {totalCartItemsCount > 0 && (
                <div className="absolute bottom-6 left-4 right-4 z-20">
                    <button onClick={() => setIsCartOpen(true)} className="w-full bg-blue-600 text-white shadow-xl rounded-xl p-4 flex justify-between items-center animate-bounce-in">
                        <div className="flex items-center gap-3">
                            <span className="bg-white text-blue-600 font-bold w-8 h-8 rounded-full flex items-center justify-center">{totalCartItemsCount}</span>
                            <div className="text-left leading-tight">
                                <span className="font-bold text-lg block">{t('ดูตะกร้า')}</span>
                                <span className="text-xs font-light text-blue-100">{t('ยังไม่รวมกับยอดบิล')}</span>
                            </div>
                        </div>
                        <span className="font-bold text-lg">{cartTotalAmount.toLocaleString()} ฿</span>
                    </button>
                </div>
            )}

            {/* My Orders List Modal */}
            {isActiveOrderListOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-end sm:items-center" onClick={() => setIsActiveOrderListOpen(false)}>
                    <div className="bg-white w-full sm:max-w-md h-[80vh] sm:h-auto sm:max-h-[90vh] rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div ref={billContentRef} className="flex-grow overflow-y-auto">
                            <div className="p-4 border-b bg-gray-50 flex flex-col items-center sticky top-0 z-10">
                                {logoUrl && <img src={logoUrl} alt="Logo" className="h-16 w-auto object-contain mb-2" crossOrigin="anonymous" />}
                                <h3 className="font-bold text-gray-800 text-lg">{t('รายการของฉัน')} ({t('คุณ')}{customerName}) 🧾</h3>
                                <p className="text-sm text-gray-600">{t('โต๊ะ')} {table.name} ({table.floor})</p>
                            </div>
                            <div className="p-4 space-y-4">
                                {myItems.length === 0 && otherItems.length === 0 ? (
                                    <div className="text-center text-gray-400 py-10">{t('ยังไม่มีรายการที่สั่ง')}</div>
                                ) : (
                                    <>
                                        {myItems.length > 0 && (
                                            <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                                                <h4 className="font-bold text-blue-800 text-sm mb-2 flex items-center gap-1">{t('รายการของคุณ')} <span className="text-xs font-normal text-blue-600">({customerName})</span> 👤</h4>
                                                <ul className="space-y-3">
                                                    {myItems.map((item, idx) => (
                                                        <li key={`mine-${idx}`} className="flex justify-between text-sm text-gray-700 border-b border-blue-100 pb-2 last:border-0">
                                                            <div>
                                                                <span className="font-medium">{item.quantity}x {item.name}</span>
                                                                {item.isTakeaway && <span className="text-purple-600 text-xs ml-1">({t('สั่งกลับบ้าน')})</span>}
                                                                {item.selectedOptions.length > 0 && <div className="text-xs text-gray-500 ml-1">{item.selectedOptions.map(o => o.name).join(', ')}</div>}
                                                            </div>
                                                            <span className="font-mono text-gray-600 font-bold">{(item.finalPrice * item.quantity).toLocaleString()}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {otherItems.length > 0 && (
                                            <div className="bg-gray-50 p-2 rounded-lg border border-gray-200 mt-2">
                                                <h4 className="font-bold text-gray-600 text-sm mb-2">{t('รายการของเพื่อนร่วมโต๊ะ')} 👥</h4>
                                                <ul className="space-y-3">
                                                    {otherItems.map(({ item, owner }, idx) => (
                                                        <li key={`other-${idx}`} className="flex justify-between text-sm text-gray-700 border-b border-gray-200 pb-2 last:border-0">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-medium">{item.quantity}x {item.name}</span>
                                                                    <span className="text-[10px] bg-gray-200 px-1.5 rounded text-gray-600">{owner}</span>
                                                                </div>
                                                                {item.isTakeaway && <span className="text-purple-600 text-xs ml-1">({t('สั่งกลับบ้าน')})</span>}
                                                                {item.selectedOptions.length > 0 && <div className="text-xs text-gray-500 ml-1">{item.selectedOptions.map(o => o.name).join(', ')}</div>}
                                                            </div>
                                                            <span className="font-mono text-gray-500">{(item.finalPrice * item.quantity).toLocaleString()}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                            <div className="p-4 bg-gray-50 border-t sticky bottom-0">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-base text-gray-600">
                                        <span>{t('ยอดของฉัน')}</span>
                                        <span className="font-bold text-blue-600">{myTotal.toLocaleString()} ฿</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xl font-bold text-gray-800 pt-2 border-t border-gray-200">
                                        <span>{t('ยอดรวมทั้งโต๊ะ')}</span>
                                        <span>{grandTotal.toLocaleString()} ฿</span>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 text-center mt-2">{t('* ราคานี้เป็นเฉพาะรายการที่คุณสั่ง')}</p>
                            </div>
                        </div>
                        <div className="p-3 bg-white border-t flex flex-col gap-2">
                            <button onClick={handleSaveBillAsImage} disabled={myItems.length === 0} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-green-700 transition-colors text-base flex items-center justify-center gap-2 disabled:bg-gray-400">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 9.293a1 1 0 011.414 0L10 11.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 011.414-1.414L9 9.586V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                                {t('บันทึกรายการของฉัน')}
                            </button>
                            <button onClick={() => setIsActiveOrderListOpen(false)} className="w-full py-2 text-gray-700 font-semibold rounded-lg hover:bg-gray-100">{t('ปิด')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cart Modal */}
            {isCartOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end sm:justify-center items-end sm:items-center">
                    <div className="bg-white w-full sm:max-w-md h-[90vh] sm:h-[80vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col animate-slide-up">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800">{t('รายการในตะกร้า (ยังไม่สั่ง)')}</h2>
                            <button onClick={() => setIsCartOpen(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                                <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {cartItems.map(item => (
                                <div key={item.cartItemId} className="flex justify-between items-start border-b pb-4">
                                    <div className="flex-1">
                                        <p className="font-bold text-gray-800">{item.name}</p>
                                        <p className="text-sm text-gray-500">{item.selectedOptions.map(o => o.name).join(', ')}</p>
                                        {item.notes && <p className="text-sm text-yellow-600">** {item.notes}</p>}
                                        <p className="text-blue-600 font-semibold mt-1">{item.finalPrice.toLocaleString()} ฿ x {item.quantity}</p>
                                    </div>
                                    <button onClick={() => handleRemoveItem(item.cartItemId)} className="text-red-500 p-2">{t('ลบ')}</button>
                                </div>
                            ))}
                            {cartItems.length === 0 && <div className="text-center text-gray-400 py-10">{t('ไม่มีสินค้าในตะกร้า')}</div>}
                        </div>
                        <div className="p-4 border-t bg-gray-50">
                            <div className="flex justify-between mb-4 text-lg font-bold">
                                <span>{t('ยอดในตะกร้า')}</span>
                                <span>{cartTotalAmount.toLocaleString()} ฿</span>
                            </div>
                            <button onClick={handleSubmitOrder} className="w-full bg-green-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-green-700 transition-colors text-lg">{t('ยืนยันสั่งอาหาร 🚀')}</button>
                        </div>
                    </div>
                </div>
            )}

            <ItemCustomizationModal 
                isOpen={!!itemToCustomize} 
                onClose={() => setItemToCustomize(null)} 
                item={itemToCustomize} 
                onConfirm={handleConfirmCustomization} 
            />
        </div>
    );
};
