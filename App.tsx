import React, { useState, useEffect, useMemo, useRef, Suspense, useCallback } from 'react';
import Swal from 'sweetalert2';
import { useFirestoreSync, useFirestoreCollection } from './hooks/useFirestoreSync';
import { printerService } from './services/printerService'; // Added import
import { LoginScreen } from './components/LoginScreen';
import { BranchSelectionScreen } from './components/BranchSelectionScreen';
import { QueueDisplay } from './components/QueueDisplay';
import AdminSidebar from './components/AdminSidebar';
import { Header } from './components/Header';
import { Menu } from './components/Menu';
import { Sidebar } from './components/Sidebar';
import { BottomNavBar } from './components/BottomNavBar';
import { LoginModal } from './components/LoginModal';
import { MenuItemModal } from './components/MenuItemModal';
import { OrderSuccessModal } from './components/OrderSuccessModal';
import { SplitBillModal } from './components/SplitBillModal';
import { TableBillModal } from './components/TableBillModal';
import { PaymentModal } from './components/PaymentModal';
import { PaymentSuccessModal } from './components/PaymentSuccessModal';
import { SettingsModal } from './components/SettingsModal';
import { EditCompletedOrderModal } from './components/EditCompletedOrderModal';
import { UserManagerModal } from './components/UserManagerModal';
import { BranchManagerModal } from './components/BranchManagerModal';
import { MoveTableModal } from './components/MoveTableModal';
import { CancelOrderModal } from './components/CancelOrderModal';
import { CashBillModal } from './components/CashBillModal';
import { SplitCompletedBillModal } from './components/SplitCompletedBillModal';
import { ItemCustomizationModal } from './components/ItemCustomizationModal';
import { LeaveRequestModal } from './components/LeaveRequestModal';
import { MenuSearchModal } from './components/MenuSearchModal';
import { MergeBillModal } from './components/MergeBillModal';
import { TableLayout } from './components/TableLayout';
import { CustomerView } from './components/CustomerView'; 

import { 
    DEFAULT_BRANCHES, DEFAULT_USERS, DEFAULT_MENU_ITEMS, DEFAULT_CATEGORIES, 
    DEFAULT_TABLES, DEFAULT_FLOORS, DEFAULT_STOCK_ITEMS, 
    DEFAULT_STOCK_CATEGORIES, DEFAULT_STOCK_UNITS, DEFAULT_MAINTENANCE_ITEMS,
    DEFAULT_DELIVERY_PROVIDERS 
} from './constants';

import type { 
    User, Branch, MenuItem, Table, ActiveOrder, CompletedOrder, 
    CancelledOrder, StockItem, PrintHistoryEntry, MaintenanceItem, 
    MaintenanceLog, OrderCounter, StaffCall, LeaveRequest, 
    OrderItem, PrinterConfig, DeliveryProvider, View, NavItem,
    PaymentDetails, CancellationReason
} from './types';

// Lazy load heavy components
const KitchenView = React.lazy(() => import('./components/KitchenView').then(module => ({ default: module.KitchenView })));
const Dashboard = React.lazy(() => import('./components/Dashboard').then(module => ({ default: module.Dashboard })));
const SalesHistory = React.lazy(() => import('./components/SalesHistory').then(module => ({ default: module.SalesHistory })));
const StockManagement = React.lazy(() => import('./components/StockManagement').then(module => ({ default: module.StockManagement })));
const LeaveCalendarView = React.lazy(() => import('./components/LeaveCalendarView').then(module => ({ default: module.LeaveCalendarView })));
const StockAnalytics = React.lazy(() => import('./components/StockAnalytics').then(module => ({ default: module.StockAnalytics })));
const LeaveAnalytics = React.lazy(() => import('./components/LeaveAnalytics').then(module => ({ default: module.LeaveAnalytics })));
const MaintenanceView = React.lazy(() => import('./components/MaintenanceView').then(module => ({ default: module.MaintenanceView })));

// Loading Spinner Component with more info
const PageLoading = ({ message }: { message?: string }) => (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50 z-50 fixed top-0 left-0">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-red-600 mb-6"></div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">กำลังโหลดข้อมูล...</h2>
        <p className="text-gray-500 font-medium animate-pulse">{message || 'กำลังซิงค์ข้อมูลจาก Cloud'}</p>
    </div>
);

export const App: React.FC = () => {
    // 1. STATE INITIALIZATION
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // --- AUTH & BRANCH STATE ---
    // Destructure isSynced to control global loading
    const [users, setUsers, isUsersSynced] = useFirestoreSync<User[]>(null, 'users', DEFAULT_USERS);
    const [branches, setBranches, isBranchesSynced] = useFirestoreSync<Branch[]>(null, 'branches', DEFAULT_BRANCHES);
    
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            try {
                return JSON.parse(storedUser);
            } catch (e) {
                console.error('Error parsing stored user', e);
                localStorage.removeItem('currentUser');
                return null;
            }
        }
        return null;
    });

    const [selectedBranch, setSelectedBranch] = useState<Branch | null>(() => {
        const params = new URLSearchParams(window.location.search);
        const isCustomer = params.get('mode') === 'customer';

        if (isCustomer) {
            const customerBranch = localStorage.getItem('customerSelectedBranch');
            if (customerBranch) {
                try {
                    return JSON.parse(customerBranch);
                } catch (e) {
                    localStorage.removeItem('customerSelectedBranch');
                }
            }
        }
        
        const staffBranch = localStorage.getItem('selectedBranch');
        if (staffBranch) {
            try {
                return JSON.parse(staffBranch);
            } catch (e) {
                localStorage.removeItem('selectedBranch');
            }
        }

        return null;
    });
    
    // ... (Keep existing states) ...
    const [currentView, setCurrentView] = useState<View>(() => {
        const storedView = localStorage.getItem('currentView');
        if (storedView && ['pos', 'kitchen', 'tables', 'dashboard', 'history', 'stock', 'leave', 'stock-analytics', 'leave-analytics', 'maintenance'].includes(storedView)) {
            return storedView as View;
        }
        return 'pos';
    });
    const [isEditMode, setIsEditMode] = useState(false);
    const [isAdminSidebarCollapsed, setIsAdminSidebarCollapsed] = useState(false);
    
    // Initialize Sidebar visibility based on device type. 
    // Desktop: Visible by default. Mobile: Hidden by default (shown when cart clicked)
    const [isOrderSidebarVisible, setIsOrderSidebarVisible] = useState(window.innerWidth >= 1024);

    // FIX: Default to TRUE if no setting found, so new users get notifications by default
    const [isOrderNotificationsEnabled, setIsOrderNotificationsEnabled] = useState(() => {
        const stored = localStorage.getItem('isOrderNotificationsEnabled');
        return stored === null ? true : stored === 'true';
    });

    const toggleOrderNotifications = () => {
        setIsOrderNotificationsEnabled(prev => {
            const newValue = !prev;
            localStorage.setItem('isOrderNotificationsEnabled', String(newValue));
            return newValue;
        });
    };

    const [isAutoPrintEnabled, setIsAutoPrintEnabled] = useState(() => {
        return localStorage.getItem('isAutoPrintEnabled') === 'true';
    });

    const toggleAutoPrint = () => {
        setIsAutoPrintEnabled(prev => {
            const newValue = !prev;
            localStorage.setItem('isAutoPrintEnabled', String(newValue));
            return newValue;
        });
    };
    
    const [isQueueMode, setIsQueueMode] = useState(() => window.location.pathname === '/queue');

    const [isCustomerMode, setIsCustomerMode] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('mode') === 'customer') return true;
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            try {
                const u = JSON.parse(storedUser);
                return u.role === 'table';
            } catch (e) {
                return false;
            }
        }
        return false;
    });

    const [customerTableId, setCustomerTableId] = useState<number | null>(() => {
        const params = new URLSearchParams(window.location.search);
        const tableIdParam = params.get('tableId');
        if (tableIdParam) return Number(tableIdParam);
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            try {
                const u = JSON.parse(storedUser);
                if (u.role === 'table' && u.assignedTableId) return Number(u.assignedTableId);
            } catch (e) {
                return null;
            }
        }
        return null;
    });
    
    const urlBranchId = useMemo(() => new URLSearchParams(window.location.search).get('branchId'), []);
    const branchId = selectedBranch ? selectedBranch.id.toString() : (isCustomerMode || isQueueMode) && urlBranchId ? urlBranchId : null;

    const shouldLoadHeavyData = useMemo(() => {
        return currentUser && currentUser.role !== 'table' && !isCustomerMode;
    }, [currentUser, isCustomerMode]);

    const heavyDataBranchId = shouldLoadHeavyData ? branchId : null;

    useEffect(() => {
        if ((isCustomerMode || isQueueMode) && !selectedBranch && branches.length > 0 && urlBranchId) {
            const b = branches.find(br => br.id.toString() === urlBranchId);
            if (b) {
                setSelectedBranch(b);
                if (isCustomerMode) {
                    localStorage.setItem('customerSelectedBranch', JSON.stringify(b));
                }
            }
        }
    }, [isCustomerMode, isQueueMode, selectedBranch, branches, urlBranchId]);


    // --- ESSENTIAL DATA (Loaded for Everyone including Customers) ---
    // Add isSynced destructing for loading checks
    const [menuItems, setMenuItems, isMenuSynced] = useFirestoreSync<MenuItem[]>(branchId, 'menuItems', DEFAULT_MENU_ITEMS);
    const [categories, setCategories] = useFirestoreSync<string[]>(branchId, 'categories', DEFAULT_CATEGORIES);
    const [tables, setTables, isTablesSynced] = useFirestoreSync<Table[]>(branchId, 'tables', DEFAULT_TABLES);
    const [floors, setFloors] = useFirestoreSync<string[]>(branchId, 'floors', DEFAULT_FLOORS);
    const [recommendedMenuItemIds, setRecommendedMenuItemIds] = useFirestoreSync<number[]>(branchId, 'recommendedMenuItemIds', []);
    
    // Active Orders
    const [rawActiveOrders, activeOrdersActions] = useFirestoreCollection<ActiveOrder>(branchId, 'activeOrders');
    
    const activeOrders = useMemo(() => {
        return rawActiveOrders.filter(o => o.status !== 'completed' && o.status !== 'cancelled');
    }, [rawActiveOrders]);

    // --- HEAVY DATA ---
    const [legacyCompletedOrders, setLegacyCompletedOrders] = useFirestoreSync<CompletedOrder[]>(heavyDataBranchId, 'completedOrders', []);
    const [legacyCancelledOrders, setLegacyCancelledOrders] = useFirestoreSync<CancelledOrder[]>(heavyDataBranchId, 'cancelledOrders', []);
    const [newCompletedOrders, newCompletedOrdersActions] = useFirestoreCollection<CompletedOrder>(heavyDataBranchId, 'completedOrders_v2');
    const [newCancelledOrders, newCancelledOrdersActions] = useFirestoreCollection<CancelledOrder>(heavyDataBranchId, 'cancelledOrders_v2');

    const completedOrders = useMemo(() => {
        const combined = [...newCompletedOrders, ...legacyCompletedOrders];
        const unique = new Map<number, CompletedOrder>();
        combined.forEach(o => unique.set(o.id, o));
        return Array.from(unique.values()).sort((a, b) => b.completionTime - a.completionTime);
    }, [legacyCompletedOrders, newCompletedOrders]);

    const cancelledOrders = useMemo(() => {
        const combined = [...newCancelledOrders, ...legacyCancelledOrders];
        const unique = new Map<number, CancelledOrder>();
        combined.forEach(o => unique.set(o.id, o));
        return Array.from(unique.values()).sort((a, b) => b.cancellationTime - a.cancellationTime);
    }, [legacyCancelledOrders, newCancelledOrders]);

    const [stockItems, setStockItems] = useFirestoreSync<StockItem[]>(heavyDataBranchId, 'stockItems', DEFAULT_STOCK_ITEMS);
    const [stockCategories, setStockCategories] = useFirestoreSync<string[]>(heavyDataBranchId, 'stockCategories', DEFAULT_STOCK_CATEGORIES);
    const [stockUnits, setStockUnits] = useFirestoreSync<string[]>(heavyDataBranchId, 'stockUnits', DEFAULT_STOCK_UNITS);
    
    const [printHistory, setPrintHistory] = useFirestoreSync<PrintHistoryEntry[]>(heavyDataBranchId, 'printHistory', []);
    const [maintenanceItems, setMaintenanceItems] = useFirestoreSync<MaintenanceItem[]>(heavyDataBranchId, 'maintenanceItems', DEFAULT_MAINTENANCE_ITEMS);
    const [maintenanceLogs, setMaintenanceLogs] = useFirestoreSync<MaintenanceLog[]>(heavyDataBranchId, 'maintenanceLogs', []);
    
    const [orderCounter, setOrderCounter] = useFirestoreSync<OrderCounter>(heavyDataBranchId || branchId, 'orderCounter', { count: 0, lastResetDate: new Date().toISOString().split('T')[0] });

    const [staffCalls, setStaffCalls, isStaffCallsSynced] = useFirestoreSync<StaffCall[]>(branchId, 'staffCalls', []);
    const [leaveRequests, setLeaveRequests] = useFirestoreSync<LeaveRequest[]>(shouldLoadHeavyData ? null : 'SKIP', 'leaveRequests', []);

    // --- POS-SPECIFIC LOCAL STATE ---
    const [currentOrderItems, setCurrentOrderItems] = useState<OrderItem[]>([]);
    const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
    const [customerName, setCustomerName] = useState('');
    const [customerCount, setCustomerCount] = useState(1);
    const [selectedSidebarFloor, setSelectedSidebarFloor] = useState<string>('');
    const [notSentToKitchenDetails, setNotSentToKitchenDetails] = useState<{ reason: string; notes: string } | null>(null);

    // --- GENERAL SETTINGS STATE & SYNC FLAGS ---
    const [logoUrl, setLogoUrl, isLogoSynced] = useFirestoreSync<string | null>(branchId, 'logoUrl', null);
    const [appLogoUrl, setAppLogoUrl, isAppLogoSynced] = useFirestoreSync<string | null>(branchId, 'appLogoUrl', null);
    const [restaurantName, setRestaurantName, isNameSynced] = useFirestoreSync<string>(branchId, 'restaurantName', 'ชื่อร้านอาหาร');
    const [restaurantAddress, setRestaurantAddress, isAddrSynced] = useFirestoreSync<string>(branchId, 'restaurantAddress', '');
    const [restaurantPhone, setRestaurantPhone, isPhoneSynced] = useFirestoreSync<string>(branchId, 'restaurantPhone', '');
    const [taxId, setTaxId, isTaxSynced] = useFirestoreSync<string>(branchId, 'taxId', '');
    const [signatureUrl, setSignatureUrl, isSigSynced] = useFirestoreSync<string | null>(branchId, 'signatureUrl', null);

    const [qrCodeUrl, setQrCodeUrl, isQrSynced] = useFirestoreSync<string | null>(branchId, 'qrCodeUrl', null);
    const [notificationSoundUrl, setNotificationSoundUrl, isNotifySoundSynced] = useFirestoreSync<string | null>(branchId, 'notificationSoundUrl', null);
    const [staffCallSoundUrl, setStaffCallSoundUrl, isStaffSoundSynced] = useFirestoreSync<string | null>(branchId, 'staffCallSoundUrl', null);
    const [printerConfig, setPrinterConfig, isPrinterSynced] = useFirestoreSync<PrinterConfig | null>(branchId, 'printerConfig', null);
    const [openingTime, setOpeningTime, isOpenTimeSynced] = useFirestoreSync<string | null>(branchId, 'openingTime', '10:00');
    const [closingTime, setClosingTime, isCloseTimeSynced] = useFirestoreSync<string | null>(branchId, 'closingTime', '22:00');
    const [isTaxEnabled, setIsTaxEnabled] = useFirestoreSync<boolean>(branchId, 'isTaxEnabled', false);
    const [taxRate, setTaxRate] = useFirestoreSync<number>(branchId, 'taxRate', 7);
    const [sendToKitchen, setSendToKitchen] = useFirestoreSync<boolean>(branchId, 'sendToKitchen', true);
    const [deliveryProviders, setDeliveryProviders, isDeliverySynced] = useFirestoreSync<DeliveryProvider[]>(branchId, 'deliveryProviders', DEFAULT_DELIVERY_PROVIDERS);

    const areSettingsSynced = useMemo(() => {
        return isLogoSynced && isAppLogoSynced && isNameSynced && isAddrSynced && isPhoneSynced &&
               isTaxSynced && isSigSynced && isQrSynced && isNotifySoundSynced && isStaffSoundSynced &&
               isPrinterSynced && isOpenTimeSynced && isCloseTimeSynced && isDeliverySynced;
    }, [isLogoSynced, isAppLogoSynced, isNameSynced, isAddrSynced, isPhoneSynced, isTaxSynced, isSigSynced, isQrSynced, isNotifySoundSynced, isStaffSoundSynced, isPrinterSynced, isOpenTimeSynced, isCloseTimeSynced, isDeliverySynced]);


    // --- MODAL STATES ---
    const [modalState, setModalState] = useState({
        isMenuItem: false, isOrderSuccess: false, isSplitBill: false, isTableBill: false,
        isPayment: false, isPaymentSuccess: false, isSettings: false, isEditCompleted: false,
        isUserManager: false, isBranchManager: false, isMoveTable: false, isCancelOrder: false,
        isCashBill: false, isSplitCompleted: false, isCustomization: false, isLeaveRequest: false,
        isMenuSearch: false, isMergeBill: false
    });
    
    // ... (Keep existing refs/states) ...
    const [itemToEdit, setItemToEdit] = useState<MenuItem | null>(null);
    const [itemToCustomize, setItemToCustomize] = useState<MenuItem | null>(null);
    const [orderItemToEdit, setOrderItemToEdit] = useState<OrderItem | null>(null); 
    const [orderForModal, setOrderForModal] = useState<ActiveOrder | CompletedOrder | null>(null);
    // NEW: State for storing the actual order number (e.g. 1, 2) instead of the timestamp ID
    const [lastPlacedOrderNumber, setLastPlacedOrderNumber] = useState<number | null>(null);
    const [leaveRequestInitialDate, setLeaveRequestInitialDate] = useState<Date | null>(null);

    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
    const [isCachingImages, setIsCachingImages] = useState(false);
    const imageCacheTriggeredRef = useRef(false);
    const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);

    // --- Order Placement Handler ---
    const handlePlaceOrder = useCallback(async (
        items: OrderItem[], 
        custName: string, 
        custCount: number, 
        tableOverride: Table | null, 
        isLineMan: boolean = false, 
        lineManNumber?: string, 
        deliveryProviderName?: string
    ) => {
        setIsPlacingOrder(true);
        try {
            // --- DAILY RESET LOGIC ---
            const d = new Date();
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const today = `${year}-${month}-${day}`;

            let nextOrderNum = 1;
            let lastResetDate = today;

            if (orderCounter) {
                if (orderCounter.lastResetDate !== today) {
                    nextOrderNum = 1;
                    lastResetDate = today;
                } else {
                    nextOrderNum = (orderCounter.count || 0) + 1;
                    lastResetDate = orderCounter.lastResetDate;
                }
            }

            setOrderCounter({ count: nextOrderNum, lastResetDate: lastResetDate });

            const tId = isLineMan ? -1 : (tableOverride ? tableOverride.id : (customerTableId || 0));
            const tName = isLineMan 
                ? (deliveryProviderName || 'Delivery') 
                : (tableOverride ? tableOverride.name : (tables.find(t => t.id === tId)?.name || 'Unknown'));
            
            const floorName = isLineMan ? '-' : (tableOverride ? tableOverride.floor : (tables.find(t => t.id === tId)?.floor || '-'));

            const subtotal = items.reduce((sum, i) => sum + i.finalPrice * i.quantity, 0);
            const taxVal = isTaxEnabled ? subtotal * (taxRate / 100) : 0;

            const newOrder: ActiveOrder = {
                id: Date.now(),
                orderNumber: nextOrderNum, 
                manualOrderNumber: lineManNumber || null,
                tableId: tId,
                tableName: tName,
                floor: floorName,
                customerName: custName || 'ลูกค้า',
                customerCount: custCount || 1,
                items: items,
                orderType: isLineMan ? 'lineman' : (items.some(i => i.isTakeaway) ? 'takeaway' : 'dine-in'),
                taxRate: isTaxEnabled ? taxRate : 0,
                taxAmount: taxVal,
                placedBy: isCustomerMode ? 'Customer' : (currentUser?.username || 'Staff'),
                status: 'waiting',
                orderTime: Date.now(),
            };

            await activeOrdersActions.add(newOrder);

            if (!isCustomerMode) {
                setCurrentOrderItems([]);
                setCustomerName('');
                setCustomerCount(1);
                setLastPlacedOrderNumber(nextOrderNum);
                setModalState(prev => ({ ...prev, isOrderSuccess: true }));
            }
            
            return newOrder;

        } catch (error) {
            console.error("Place order error", error);
            Swal.fire('Error', 'ไม่สามารถสั่งอาหารได้', 'error');
        } finally {
            setIsPlacingOrder(false);
        }
    }, [orderCounter, isTaxEnabled, taxRate, isCustomerMode, currentUser, activeOrdersActions, customerTableId, tables, setOrderCounter]);

    // --- Staff Call Handler ---
    const handleStaffCall = useCallback(async (tableObj: Table, custName: string) => {
        const newCall: StaffCall = {
            id: Date.now(),
            tableId: tableObj.id,
            tableName: tableObj.name,
            customerName: custName,
            branchId: selectedBranch ? selectedBranch.id : Number(urlBranchId) || 0,
            timestamp: Date.now()
        };
        // Just update Firestore; the effect below will catch it
        setStaffCalls(prev => [...prev, newCall]);
    }, [selectedBranch, urlBranchId, setStaffCalls]);

    // --- Helper: Play Audio Robustly ---
    const playAudio = (url: string | null) => {
        const audioUrl = url || "https://firebasestorage.googleapis.com/v0/b/pos-sirimonkol.firebasestorage.app/o/sounds%2Fdefault-notification.mp3?alt=media";
        const audio = new Audio(audioUrl);
        audio.play().catch(e => {
            console.warn("Audio play blocked (user interaction needed):", e);
        });
    };

    // --- Staff Call Listener (Play Sound & Show Alert) ---
    // Track last processed ID instead of length to handle array changes correctly
    const lastProcessedStaffCallId = useRef<number>(0);

    useEffect(() => {
        if (!currentUser || isCustomerMode) return; // Only for staff
        if (!isStaffCallsSynced) return;

        // Sort to get the actual latest call based on ID/Timestamp
        const sortedCalls = [...staffCalls].sort((a, b) => a.id - b.id);
        const latestCall = sortedCalls[sortedCalls.length - 1];

        // If we have a call, and it's newer than the last one we processed
        if (latestCall && latestCall.id > lastProcessedStaffCallId.current) {
            
            // Only alert if it's "New" in terms of time (e.g. created in last 5 mins)
            // AND we haven't processed it yet.
            const isRecent = (Date.now() - latestCall.timestamp) < 300000; 

            // Update the tracker so we don't process it again
            lastProcessedStaffCallId.current = latestCall.id;

            if (isRecent) {
                // 1. Play Sound
                playAudio(staffCallSoundUrl);

                // 2. Show Popup
                Swal.fire({
                    title: `🔔 เรียกพนักงาน!`,
                    html: `<div class="text-xl">โต๊ะ <b>${latestCall.tableName}</b></div><div class="text-sm text-gray-500 mt-2">(${latestCall.customerName})</div>`,
                    icon: 'info',
                    timer: 10000,
                    timerProgressBar: true,
                    showConfirmButton: true,
                    confirmButtonText: 'รับทราบ',
                    position: 'top-end',
                    toast: true
                });
            }
        } else if (staffCalls.length === 0) {
             // Reset if list is cleared
             lastProcessedStaffCallId.current = 0;
        }
    }, [staffCalls, currentUser, isCustomerMode, staffCallSoundUrl, isStaffCallsSynced]);

    // --- NEW: Order Notification Listener ---
    const prevActiveOrdersRef = useRef<ActiveOrder[]>([]);
    const isActiveOrdersFirstLoad = useRef(true);

    useEffect(() => {
        if (!currentUser || isCustomerMode) return; // Only for staff

        // 1. Filter for orders that are 'waiting' (newly placed)
        const currentWaitingOrders = activeOrders.filter(o => o.status === 'waiting');

        // 2. Initial Load Check
        if (isActiveOrdersFirstLoad.current) {
            // On first load, just memorize what we have so we don't alert for existing orders
            if (currentWaitingOrders.length > 0) {
                 prevActiveOrdersRef.current = currentWaitingOrders;
            }
            // Only set first load to false if we actually have data or if sync is likely done. 
            // Since activeOrders updates dynamically, let's just set it false after first run.
            isActiveOrdersFirstLoad.current = false;
            return;
        }

        // 3. Detect New Orders
        const prevIds = new Set(prevActiveOrdersRef.current.map(o => o.id));
        const newOrders = currentWaitingOrders.filter(o => !prevIds.has(o.id));

        if (newOrders.length > 0) {
            // 4. Check recency (ignore orders older than 5 mins to prevent spam on reconnect)
            // Use orderTime
            const hasRecent = newOrders.some(o => (Date.now() - o.orderTime) < 300000);

            if (hasRecent) {
                // Check if notification is enabled
                if (isOrderNotificationsEnabled) {
                     // Play Sound
                     playAudio(notificationSoundUrl);
     
                     // Show Swal Notification
                     Swal.fire({
                         title: 'มีออเดอร์ใหม่!',
                         text: `${newOrders.length} รายการใหม่ส่งเข้าครัว`,
                         icon: 'success',
                         timer: 5000,
                         timerProgressBar: true,
                         position: 'top-end',
                         toast: true,
                         showConfirmButton: false
                     });
                }
            }
        }

        // Update ref
        prevActiveOrdersRef.current = currentWaitingOrders;

    }, [activeOrders, currentUser, isCustomerMode, notificationSoundUrl, isOrderNotificationsEnabled]);


    // --- Kitchen Handlers (Start, Complete, Print) ---
    const handleStartCooking = async (orderId: number) => {
        await activeOrdersActions.update(orderId, { 
            status: 'cooking',
            cookingStartTime: Date.now()
        });
    };

    const handleCompleteCooking = async (orderId: number) => {
        // "BUMP" means served/completed from kitchen view. 
        // In this system's flow, it sets status to 'served'.
        await activeOrdersActions.update(orderId, { status: 'served' });
    };

    const handlePrintKitchenOrder = async (orderId: number) => {
        const order = activeOrders.find(o => o.id === orderId);
        if (!order) return;
        
        if (!printerConfig?.kitchen?.ipAddress) {
             Swal.fire({
                icon: 'warning',
                title: 'ไม่ได้ตั้งค่าเครื่องพิมพ์',
                text: 'กรุณาตั้งค่าเครื่องพิมพ์ครัวในเมนูตั้งค่าก่อน',
                timer: 2000,
                showConfirmButton: false
            });
            return;
        }

        try {
            Swal.fire({
                title: 'กำลังส่งคำสั่งพิมพ์...',
                didOpen: () => { Swal.showLoading(); }
            });
            await printerService.printKitchenOrder(order, printerConfig.kitchen);
            Swal.close();
            Swal.fire({
                icon: 'success',
                title: 'ส่งพิมพ์เรียบร้อย',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 1500
            });
        } catch (error: any) {
            Swal.close();
            Swal.fire({
                icon: 'error',
                title: 'พิมพ์ไม่สำเร็จ',
                text: error.message
            });
        }
    };

    // ... (Keep badge calculations) ...
    const waitingBadgeCount = useMemo(() => activeOrders.filter(o => o.status === 'waiting').length, [activeOrders]);
    const cookingBadgeCount = useMemo(() => activeOrders.filter(o => o.status === 'cooking').length, [activeOrders]);
    const totalKitchenBadgeCount = waitingBadgeCount + cookingBadgeCount;
    
    const occupiedTablesCount = useMemo(() => {
        const occupiedTableIds = new Set(
            activeOrders
                .filter(o => tables.some(t => t.id === o.tableId))
                .map(o => o.tableId)
        );
        return occupiedTableIds.size;
    }, [activeOrders, tables]);
    const tablesBadgeCount = occupiedTablesCount > 0 ? occupiedTablesCount : 0;
    
    const leaveBadgeCount = useMemo(() => {
        if (!currentUser) return 0;
        const filterPredicate = (req: LeaveRequest) => {
            if (req.status !== 'pending') return false;
            if (currentUser.role === 'admin') {
                return req.branchId === 1;
            }
            if (currentUser.role === 'branch-admin' || currentUser.role === 'auditor') {
                return currentUser.allowedBranchIds?.includes(req.branchId) ?? false;
            }
            return false;
        };
        return leaveRequests.filter(filterPredicate).length;
    }, [leaveRequests, currentUser]);

    const stockBadgeCount = useMemo(() => {
        return stockItems.filter(item => {
            const qty = Number(item.quantity) || 0;
            const reorder = Number(item.reorderPoint) || 0;
            return qty <= reorder;
        }).length;
    }, [stockItems]);

    const maintenanceBadgeCount = useMemo(() => {
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        return maintenanceItems.filter(item => {
            const lastDate = item.lastMaintenanceDate || 0;
            const dueDate = new Date(lastDate);
            dueDate.setMonth(dueDate.getMonth() + item.cycleMonths);
            const dueTimestamp = dueDate.getTime();
            const daysDiff = Math.ceil((dueTimestamp - now) / oneDay);
            return daysDiff <= 7;
        }).length;
    }, [maintenanceItems]);

    // ... (Keep mobileNavItems) ...
    const mobileNavItems = useMemo(() => {
        const items: NavItem[] = [
            {id: 'pos', label: 'POS', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h2a1 1 0 100-2H9z" clipRule="evenodd" /></svg>, view: 'pos'},
            {id: 'tables', label: 'ผังโต๊ะ', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2-2H4a2 2 0 01-2-2V5zm2 1v8h8V6H4z" /></svg>, view: 'tables', badge: tablesBadgeCount},
        ];
        if (currentUser?.role === 'admin' || currentUser?.role === 'branch-admin' || currentUser?.role === 'auditor') {
             items.push({
                id: 'dashboard',
                label: 'Dashboard',
                icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1-1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>,
                view: 'dashboard'
            });
        } else {
             items.push({id: 'kitchen', label: 'ครัว', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h10a3 3 0 013 3v5a.997.997 0 01-.293.707zM5 6a1 1 0 100 2 1 1 0 000-2zm3 0a1 1 0 100 2 1 1 0 000-2zm3 0a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" /></svg>, view: 'kitchen', badge: totalKitchenBadgeCount});
        }
        items.push({id: 'history', label: 'ประวัติ', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>, view: 'history'});
        items.push({id: 'stock', label: 'สต็อก', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>, view: 'stock', badge: stockBadgeCount});
        items.push({
            id: 'leave',
            label: 'วันลา',
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>,
            view: 'leave',
            badge: leaveBadgeCount
        });
        items.push({
            id: 'maintenance',
            label: 'บำรุงรักษา',
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
            view: 'maintenance',
            badge: maintenanceBadgeCount
        });
        return items;
    }, [currentUser, tablesBadgeCount, totalKitchenBadgeCount, leaveBadgeCount, stockBadgeCount, maintenanceBadgeCount]);

    const selectedTable = useMemo(() => {
        return tables.find(t => t.id === selectedTableId) || null;
    }, [tables, selectedTableId]);
    
    const vacantTablesCount = useMemo(() => {
        const occupiedTableIds = new Set(
            activeOrders
                .filter(o => tables.some(t => t.id === o.tableId))
                .map(o => o.tableId)
        );
        return Math.max(0, tables.length - occupiedTableIds.size);
    }, [tables, activeOrders]);

    const isAdminViewOnDesktop = useMemo(() => 
        (currentUser?.role === 'admin' || currentUser?.role === 'branch-admin' || currentUser?.role === 'auditor') && isDesktop,
        [currentUser, isDesktop]
    );
    
    const totalCartItemCount = useMemo(() => {
        return currentOrderItems.reduce((acc, item) => acc + item.quantity, 0);
    }, [currentOrderItems]);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => { setIsOnline(false); Swal.fire({ icon: 'warning', title: 'ขาดการเชื่อมต่อ', text: 'อินเทอร์เน็ตของคุณหลุด ระบบจะป้องกันการบันทึกข้อมูลเพื่อความปลอดภัย กรุณาตรวจสอบอินเทอร์เน็ต', toast: true, position: 'top-end', showConfirmButton: false, timer: 5000 }); };
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
    }, []);

    // --- Handlers ---
    const handleLogin = (username: string) => {
        const user = users.find(u => u.username === username);
        if (user) {
            setCurrentUser(user);
            localStorage.setItem('currentUser', JSON.stringify(user));
            return { success: true };
        }
        return { success: false, error: 'User not found' };
    };

    const handleLogout = () => {
        setCurrentUser(null);
        localStorage.removeItem('currentUser');
        setSelectedBranch(null);
        localStorage.removeItem('selectedBranch');
    };

    const handleSelectBranch = (branch: Branch) => {
        setSelectedBranch(branch);
        localStorage.setItem('selectedBranch', JSON.stringify(branch));
    };

    const handleUpdateCurrentUser = (updates: Partial<User>) => {
        if (!currentUser) return;
        const updated = { ...currentUser, ...updates };
        setCurrentUser(updated);
        localStorage.setItem('currentUser', JSON.stringify(updated));
    };

    const handleSaveMenuItem = (item: Omit<MenuItem, 'id'> & { id?: number }) => {
        if (item.id) {
            setMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, ...item } as MenuItem : m));
        } else {
            const newItem = { ...item, id: Date.now() } as MenuItem;
            setMenuItems(prev => [...prev, newItem]);
        }
        setModalState(prev => ({ ...prev, isMenuItem: false }));
    };

    const handleAddCategory = (name: string) => {
        if (!categories.includes(name)) {
            setCategories(prev => [...prev, name]);
        }
    };

    const handleConfirmSplit = async (itemsToSplit: OrderItem[]) => {
        if (!orderForModal) return;
        // Verify it is an ActiveOrder (has status)
        const originalOrder = activeOrders.find(o => o.id === orderForModal.id);
        if (!originalOrder) {
             Swal.fire('Error', 'Order not found or already completed', 'error');
             return;
        }

        try {
            // 1. Calculate New Items for New Order
            const newOrderItems = itemsToSplit.map(i => ({...i})); // Deep copy safe enough for this level

            // 2. Calculate Remaining Items for Original Order
            const remainingItems = originalOrder.items.map(item => {
                const splitItem = itemsToSplit.find(si => si.cartItemId === item.cartItemId);
                if (splitItem) {
                    return { ...item, quantity: item.quantity - splitItem.quantity };
                }
                return item;
            }).filter(item => item.quantity > 0);

            // 3. Prepare New Order Data
            // Logic to get next order number (Duplicated from handlePlaceOrder for reliability)
            let nextOrderNum = (orderCounter?.count || 0) + 1;
            const today = new Date().toISOString().split('T')[0];
            if (orderCounter && orderCounter.lastResetDate !== today) {
                nextOrderNum = 1;
            }
            
            // Calculate financial for new order
            const newSubtotal = newOrderItems.reduce((sum, i) => sum + (i.finalPrice * i.quantity), 0);
            const newTax = isTaxEnabled ? newSubtotal * (taxRate / 100) : 0;

            const newOrder: ActiveOrder = {
                ...originalOrder, // Copy common fields (table, customer name, etc)
                id: Date.now(),
                orderNumber: nextOrderNum,
                items: newOrderItems,
                taxAmount: newTax,
                isSplitChild: true,
                parentOrderId: originalOrder.orderNumber,
                status: originalOrder.status, 
                mergedOrderNumbers: [] 
            };

            // 4. Update Original Order Data
            const origSubtotal = remainingItems.reduce((sum, i) => sum + (i.finalPrice * i.quantity), 0);
            const origTax = isTaxEnabled ? origSubtotal * (taxRate / 100) : 0;

            // 5. Execute Firestore Actions
            // Add new order
            await activeOrdersActions.add(newOrder);
            
            // Update old order
            await activeOrdersActions.update(originalOrder.id, { 
                items: remainingItems,
                taxAmount: origTax
            });

            // Update Counter
            setOrderCounter({ count: nextOrderNum, lastResetDate: today });

            setModalState(prev => ({ ...prev, isSplitBill: false, isTableBill: false }));
            Swal.fire({
                icon: 'success',
                title: 'แยกบิลสำเร็จ',
                text: `สร้างบิลใหม่ #${nextOrderNum} เรียบร้อยแล้ว`,
                timer: 1500,
                showConfirmButton: false
            });

        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'ไม่สามารถแยกบิลได้', 'error');
        }
    };

    const handleConfirmPayment = (orderId: number, paymentDetails: PaymentDetails) => {
        const order = activeOrders.find(o => o.id === orderId);
        if (order) {
            const completedOrder: CompletedOrder = {
                ...order,
                status: 'completed',
                completionTime: Date.now(),
                paymentDetails,
                completedBy: currentUser?.username || 'Unknown'
            };
            newCompletedOrdersActions.add(completedOrder);
            activeOrdersActions.remove(orderId);
            setModalState(prev => ({ ...prev, isPayment: false, isPaymentSuccess: true }));
        }
    };

    const handleMergeAndPay = async (sourceOrderIds: number[], targetOrderId: number) => {
        try {
            const targetOrder = activeOrders.find(o => o.id === targetOrderId);
            if (!targetOrder) throw new Error("Target order not found");

            let mergedItems = [...targetOrder.items];
            let mergedCustomerCount = targetOrder.customerCount;
            let mergedOrderNumbers = targetOrder.mergedOrderNumbers || [];
            
            // Track IDs to remove to avoid modifying array while iterating
            const idsToRemove: number[] = [];

            for (const sourceId of sourceOrderIds) {
                const sourceOrder = activeOrders.find(o => o.id === sourceId);
                if (sourceOrder) {
                    // Merge Items
                    sourceOrder.items.forEach(sourceItem => {
                        const existingItemIndex = mergedItems.findIndex(mi => mi.cartItemId === sourceItem.cartItemId);
                        if (existingItemIndex > -1) {
                            mergedItems[existingItemIndex] = {
                                ...mergedItems[existingItemIndex],
                                quantity: mergedItems[existingItemIndex].quantity + sourceItem.quantity
                            };
                        } else {
                            mergedItems.push(sourceItem);
                        }
                    });

                    // Merge Metadata
                    mergedCustomerCount += sourceOrder.customerCount;
                    mergedOrderNumbers.push(sourceOrder.orderNumber);
                    if (sourceOrder.mergedOrderNumbers) {
                        mergedOrderNumbers = [...mergedOrderNumbers, ...sourceOrder.mergedOrderNumbers];
                    }
                    
                    idsToRemove.push(sourceId);
                }
            }

            // Recalculate Tax for Target
            const newSubtotal = mergedItems.reduce((sum, i) => sum + (i.finalPrice * i.quantity), 0);
            const newTax = isTaxEnabled ? newSubtotal * (taxRate / 100) : 0;

            // Update Target
            await activeOrdersActions.update(targetOrderId, {
                items: mergedItems,
                customerCount: mergedCustomerCount,
                taxAmount: newTax,
                mergedOrderNumbers: [...new Set(mergedOrderNumbers)]
            });

            // Remove Sources
            for (const id of idsToRemove) {
                await activeOrdersActions.remove(id);
            }

            setModalState(prev => ({ ...prev, isMergeBill: false, isTableBill: false }));
            Swal.fire({
                icon: 'success',
                title: 'รวมบิลสำเร็จ',
                text: `รวม ${idsToRemove.length} บิลเข้ากับ #${targetOrder.orderNumber} แล้ว`,
                timer: 1500,
                showConfirmButton: false
            });

        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'ไม่สามารถรวมบิลได้', 'error');
        }
    };

    const handleConfirmMoveTable = (orderId: number, newTableId: number) => {
        activeOrdersActions.update(orderId, { tableId: newTableId });
        setModalState(prev => ({ ...prev, isMoveTable: false }));
    };

    const handleConfirmCancelOrder = (order: ActiveOrder, reason: CancellationReason, notes?: string) => {
        const cancelledOrder: CancelledOrder = {
            ...order,
            status: 'cancelled',
            cancellationTime: Date.now(),
            cancellationReason: reason,
            cancellationNotes: notes,
            cancelledBy: currentUser?.username || 'Unknown'
        };
        newCancelledOrdersActions.add(cancelledOrder);
        activeOrdersActions.remove(order.id);
        setModalState(prev => ({ ...prev, isCancelOrder: false }));
    };

    const handleUpdateOrderFromModal = (orderId: number, items: OrderItem[], count: number) => {
        activeOrdersActions.update(orderId, { items, customerCount: count });
        setModalState(prev => ({ ...prev, isTableBill: false }));
    };

    const handlePaymentSuccessClose = () => {
        setModalState(prev => ({ ...prev, isPaymentSuccess: false }));
    };

    const handleAddItemToOrder = (item: MenuItem) => {
        const newItem: OrderItem = {
            ...item,
            quantity: 1,
            isTakeaway: false,
            cartItemId: `${item.id}-${Date.now()}`,
            finalPrice: item.price,
            selectedOptions: []
        };
        setCurrentOrderItems(prev => [...prev, newItem]);
    };

    const handleToggleAvailability = (id: number) => {
        setMenuItems(prev => prev.map(m => m.id === id ? { ...m, isAvailable: !m.isAvailable } : m));
    };

    const handleAudioUnlock = () => {
        if (!isAudioUnlocked) {
            const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
            audio.play().then(() => {
                setIsAudioUnlocked(true);
            }).catch(e => console.error("Audio unlock failed", e));
        }
    };

    const handleModalClose = () => {
        setModalState({
            isMenuItem: false, isOrderSuccess: false, isSplitBill: false, isTableBill: false,
            isPayment: false, isPaymentSuccess: false, isSettings: false, isEditCompleted: false,
            isUserManager: false, isBranchManager: false, isMoveTable: false, isCancelOrder: false,
            isCashBill: false, isSplitCompleted: false, isCustomization: false, isLeaveRequest: false,
            isMenuSearch: false, isMergeBill: false
        });
        setOrderForModal(null);
        setItemToEdit(null);
        setItemToCustomize(null);
    };

    const handleConfirmCustomization = (itemToAdd: OrderItem) => {
        setCurrentOrderItems(prev => {
            const existingItem = prev.find(i => i.cartItemId === itemToAdd.cartItemId);
            if (existingItem) {
                return prev.map(i => i.cartItemId === itemToAdd.cartItemId ? { ...i, quantity: i.quantity + itemToAdd.quantity } : i);
            }
            return [...prev, itemToAdd];
        });
        setModalState(prev => ({ ...prev, isCustomization: false }));
    };

    // --- FIX: Implement Delete History Logic with Roles ---
    const handleDeleteHistory = async (completedIds: number[], cancelledIds: number[], printIds: number[]) => {
        if (!currentUser) return;
        const isAdmin = currentUser.role === 'admin';
        const deleterName = currentUser.username || 'Unknown';

        try {
            // Completed Orders
            for (const id of completedIds) {
                if (isAdmin) {
                    // Admin: Permanent Delete
                    await newCompletedOrdersActions.remove(id);
                    setLegacyCompletedOrders(prev => prev.filter(o => o.id !== id));
                } else {
                    // Manager: Soft Delete (Hide from list but kept in DB as deleted)
                    await newCompletedOrdersActions.update(id, { isDeleted: true, deletedBy: deleterName });
                    setLegacyCompletedOrders(prev => prev.map(o => o.id === id ? { ...o, isDeleted: true, deletedBy: deleterName } : o));
                }
            }
            
            // Cancelled Orders
            for (const id of cancelledIds) {
                if (isAdmin) {
                    await newCancelledOrdersActions.remove(id);
                    setLegacyCancelledOrders(prev => prev.filter(o => o.id !== id));
                } else {
                    await newCancelledOrdersActions.update(id, { isDeleted: true, deletedBy: deleterName });
                    setLegacyCancelledOrders(prev => prev.map(o => o.id === id ? { ...o, isDeleted: true, deletedBy: deleterName } : o));
                }
            }

            // Print History (Currently array based, so we just remove or mark locally)
            // For simplicity in the array hook, we filter it out. 
            // In a real app, this should be a collection too for granular soft delete.
            if (printIds.length > 0) {
                if (isAdmin) {
                    setPrintHistory(prev => prev.filter(p => !printIds.includes(p.id)));
                } else {
                    setPrintHistory(prev => prev.map(p => printIds.includes(p.id) ? { ...p, isDeleted: true, deletedBy: deleterName } : p));
                }
            }
        } catch (e) {
            console.error("Delete history failed", e);
            Swal.fire('Error', 'Failed to delete history items', 'error');
        }
    };

    // --- Table Management Handlers ---
    const handleAddFloor = async () => {
        const { value: floorName } = await Swal.fire({
            title: 'เพิ่มชั้นใหม่',
            input: 'text',
            inputLabel: 'ชื่อชั้น (เช่น ชั้น 2, โซนสวน)',
            showCancelButton: true,
            inputValidator: (value) => {
                if (!value) return 'กรุณากรอกชื่อชั้น';
                if (floors.includes(value)) return 'ชื่อชั้นนี้มีอยู่แล้ว';
            }
        });

        if (floorName) {
            setFloors(prev => [...prev, floorName]);
            setSelectedSidebarFloor(floorName);
        }
    };

    const handleRemoveFloor = (floor: string) => {
        const tablesOnFloor = tables.filter(t => t.floor === floor);
        if (tablesOnFloor.length > 0) {
            Swal.fire('ไม่สามารถลบได้', `ยังมีโต๊ะอยู่ใน ${floor} กรุณาลบโต๊ะออกก่อน`, 'warning');
            return;
        }
        
        Swal.fire({
            title: `ลบชั้น "${floor}"?`,
            text: "คุณแน่ใจหรือไม่?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'ลบเลย'
        }).then((result) => {
            if (result.isConfirmed) {
                setFloors(prev => {
                    const newFloors = prev.filter(f => f !== floor);
                    if (selectedSidebarFloor === floor && newFloors.length > 0) {
                        setSelectedSidebarFloor(newFloors[0]);
                    } else if (newFloors.length === 0) {
                        setSelectedSidebarFloor('');
                    }
                    return newFloors;
                });
            }
        });
    };

    const handleAddNewTable = async (floor: string) => {
        if (!floor) return;
        
        // Auto-generate name suggestion
        const tablesOnFloor = tables.filter(t => t.floor === floor);
        const existingNums = tablesOnFloor.map(t => {
            const match = t.name.match(/\d+/);
            return match ? parseInt(match[0]) : 0;
        });
        const maxNum = existingNums.length > 0 ? Math.max(...existingNums) : 0;
        const defaultName = `T${maxNum + 1}`;

        const { value: tableName } = await Swal.fire({
            title: 'เพิ่มโต๊ะใหม่',
            input: 'text',
            inputLabel: `ชื่อโต๊ะ (สำหรับ ${floor})`,
            inputValue: defaultName,
            showCancelButton: true,
            inputValidator: (value) => {
                if (!value) return 'กรุณากรอกชื่อโต๊ะ';
                if (tables.some(t => t.name === value && t.floor === floor)) return 'ชื่อโต๊ะนี้มีอยู่แล้วในชั้นนี้';
            }
        });

        if (tableName) {
            setTables(prev => {
                const maxId = prev.length > 0 ? Math.max(...prev.map(t => t.id)) : 0;
                return [...prev, { 
                    id: maxId + 1, 
                    name: tableName, 
                    floor: floor, 
                    activePin: null, 
                    reservation: null 
                }];
            });
        }
    };

    const handleRemoveLastTable = (floor: string) => {
        const tablesOnFloor = tables.filter(t => t.floor === floor);
        if (tablesOnFloor.length === 0) return;

        // Sort by ID descending to get the last created one usually, or highest number in name
        // Let's assume highest ID is the most recent.
        const lastTable = tablesOnFloor.sort((a, b) => b.id - a.id)[0];

        // Check active orders
        const isOccupied = activeOrders.some(o => o.tableId === lastTable.id && o.status !== 'completed' && o.status !== 'cancelled');
        if (isOccupied) {
             Swal.fire('ไม่สามารถลบได้', `โต๊ะ ${lastTable.name} กำลังใช้งานอยู่`, 'warning');
             return;
        }

        Swal.fire({
            title: `ลบโต๊ะ ${lastTable.name}?`,
            text: 'คุณแน่ใจหรือไม่?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'ลบเลย'
        }).then((result) => {
            if (result.isConfirmed) {
                setTables(prev => prev.filter(t => t.id !== lastTable.id));
            }
        });
    };

    // --- RENDER LOGIC ---
    // GLOBAL LOADING: If critical data isn't synced yet, show loading
    const isCriticalDataSynced = isUsersSynced && isBranchesSynced && isMenuSynced && isTablesSynced;
    
    if (!isCriticalDataSynced && !isCustomerMode && !isQueueMode) {
        return <PageLoading message="กำลังซิงค์ข้อมูล... กรุณารอสักครู่เพื่อความปลอดภัยของข้อมูล" />;
    }

    if (isQueueMode) {
        if (!branchId) return <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-900 text-white"><h1>Error</h1></div>;
        if (!selectedBranch) return <PageLoading />;
        return <Suspense fallback={<PageLoading />}><QueueDisplay activeOrders={activeOrders} restaurantName={restaurantName} logoUrl={appLogoUrl || logoUrl} /></Suspense>;
    }

    if (isCustomerMode || currentUser?.role === 'table') {
        const table = tables.find(t => t.id === customerTableId);
        if (!table) return <PageLoading />;
        return <CustomerView 
            table={table}
            menuItems={menuItems}
            categories={categories}
            activeOrders={activeOrders} 
            allBranchOrders={activeOrders}
            completedOrders={completedOrders}
            onPlaceOrder={async (items, name) => {
                // Bridge to main app logic for consistency
                return handlePlaceOrder(items, name, 1, table, false); 
            }}
            onStaffCall={(t, name) => handleStaffCall(t, name)}
            recommendedMenuItemIds={recommendedMenuItemIds}
            logoUrl={logoUrl}
            restaurantName={restaurantName}
        />;
    }

    if (!currentUser) return <LoginScreen onLogin={handleLogin} logoUrl={appLogoUrl} restaurantName={restaurantName} />;

    if (!selectedBranch && currentUser.role !== 'admin') {
         return <BranchSelectionScreen currentUser={currentUser} branches={branches} onSelectBranch={handleSelectBranch} onManageBranches={() => setModalState(prev => ({...prev, isBranchManager: true}))} onLogout={handleLogout} />;
    }
    
    if (!selectedBranch && currentUser.role === 'admin') {
         return <BranchSelectionScreen currentUser={currentUser} branches={branches} onSelectBranch={handleSelectBranch} onManageBranches={() => setModalState(prev => ({...prev, isBranchManager: true}))} onLogout={handleLogout} />;
    }

    if (!selectedBranch) return <div>Error: No branch selected. Please log out and try again.</div>

    return (
        <div className={`h-screen w-screen flex flex-col md:flex-row bg-gray-100 overflow-hidden ${isDesktop ? 'landscape-mode' : ''}`} onClick={handleAudioUnlock}>
            {/* Desktop Admin Sidebar */}
            {isAdminViewOnDesktop && (
                <Suspense fallback={<div className="w-64 bg-gray-800 h-full animate-pulse"></div>}>
                    <AdminSidebar 
                        isCollapsed={isAdminSidebarCollapsed} onToggleCollapse={() => setIsAdminSidebarCollapsed(!isAdminSidebarCollapsed)}
                        logoUrl={appLogoUrl || logoUrl} restaurantName={restaurantName} branchName={selectedBranch.name} currentUser={currentUser}
                        onViewChange={setCurrentView} currentView={currentView} onToggleEditMode={() => setIsEditMode(!isEditMode)} isEditMode={isEditMode}
                        onOpenSettings={() => {
                            if (!areSettingsSynced) {
                                Swal.fire({ icon: 'info', title: 'กำลังโหลดข้อมูล', text: 'กรุณารอสักครู่ ข้อมูลการตั้งค่ากำลังซิงค์...', timer: 1500, showConfirmButton: false });
                                return;
                            }
                            setModalState(prev => ({...prev, isSettings: true}));
                        }} 
                        onOpenUserManager={() => setModalState(prev => ({...prev, isUserManager: true}))}
                        onManageBranches={() => setModalState(prev => ({...prev, isBranchManager: true}))} onChangeBranch={() => setSelectedBranch(null)} onLogout={handleLogout}
                        kitchenBadgeCount={totalKitchenBadgeCount} tablesBadgeCount={tablesBadgeCount} leaveBadgeCount={leaveBadgeCount} stockBadgeCount={stockBadgeCount}
                        maintenanceBadgeCount={maintenanceBadgeCount}
                        onUpdateCurrentUser={handleUpdateCurrentUser} onUpdateLogoUrl={setLogoUrl} onUpdateRestaurantName={setRestaurantName}
                        isOrderNotificationsEnabled={isOrderNotificationsEnabled} onToggleOrderNotifications={toggleOrderNotifications}
                        printerConfig={printerConfig}
                    />
                </Suspense>
            )}
            
            <div className="flex-1 flex flex-col overflow-hidden transition-all duration-300" style={{ marginLeft: isAdminViewOnDesktop ? (isAdminSidebarCollapsed ? '5rem' : '16rem') : '0' }}>
                {/* Header */}
                {isDesktop && !isAdminViewOnDesktop && (
                    <Header
                        currentView={currentView} onViewChange={setCurrentView} isEditMode={isEditMode} onToggleEditMode={() => setIsEditMode(!isEditMode)}
                        onOpenSettings={() => {
                            if (!areSettingsSynced) {
                                Swal.fire({ icon: 'info', title: 'กำลังโหลดข้อมูล', text: 'กรุณารอสักครู่...', timer: 1500, showConfirmButton: false });
                                return;
                            }
                            setModalState(prev => ({ ...prev, isSettings: true }));
                        }} 
                        cookingBadgeCount={cookingBadgeCount} waitingBadgeCount={waitingBadgeCount}
                        tablesBadgeCount={tablesBadgeCount} vacantTablesBadgeCount={vacantTablesCount} leaveBadgeCount={leaveBadgeCount} stockBadgeCount={stockBadgeCount} 
                        maintenanceBadgeCount={maintenanceBadgeCount} currentUser={currentUser} onLogout={handleLogout}
                        onOpenUserManager={() => setModalState(prev => ({ ...prev, isUserManager: true }))} 
                        logoUrl={appLogoUrl || logoUrl}
                        onLogoChangeClick={() => {}}
                        restaurantName={restaurantName} onRestaurantNameChange={setRestaurantName} branchName={selectedBranch.name}
                        onChangeBranch={() => setSelectedBranch(null)} onManageBranches={() => setModalState(prev => ({ ...prev, isBranchManager: true }))}
                        printerConfig={printerConfig}
                        isAutoPrintEnabled={isAutoPrintEnabled}
                        onToggleAutoPrint={toggleAutoPrint}
                    />
                )}
                
                <main className={`flex-1 flex overflow-hidden ${!isDesktop ? 'pb-16' : ''}`}>
                    {currentView === 'pos' && (
                        <div className="flex-1 flex overflow-hidden relative">
                            <div className="flex-1 overflow-y-auto">
                                <Menu 
                                    menuItems={menuItems} 
                                    setMenuItems={setMenuItems} 
                                    categories={categories} 
                                    onSelectItem={handleAddItemToOrder} 
                                    isEditMode={isEditMode} 
                                    onEditItem={(item) => { setItemToEdit(item); setModalState(prev => ({ ...prev, isMenuItem: true })); }} 
                                    onAddNewItem={() => { setItemToEdit(null); setModalState(prev => ({ ...prev, isMenuItem: true })); }} 
                                    onDeleteItem={(id) => { /* logic */ }} 
                                    onUpdateCategory={() => {}} 
                                    onDeleteCategory={() => {}} 
                                    onAddCategory={handleAddCategory} 
                                    onImportMenu={() => {}} 
                                    recommendedMenuItemIds={recommendedMenuItemIds} 
                                    onToggleVisibility={handleToggleAvailability}
                                    onToggleOrderSidebar={isDesktop ? () => setIsOrderSidebarVisible(!isOrderSidebarVisible) : undefined}
                                    isOrderSidebarVisible={isOrderSidebarVisible}
                                    cartItemCount={totalCartItemCount}
                                />
                            </div>
                            
                            {/* Desktop Sidebar (Side Panel) */}
                            {isDesktop && (
                                <aside className={`flex-shrink-0 transition-all duration-300 overflow-hidden ${isOrderSidebarVisible ? 'w-96' : 'w-0'}`}>
                                    {isOrderSidebarVisible && (
                                        <Sidebar
                                            currentOrderItems={currentOrderItems}
                                            onQuantityChange={(id, qty) => {
                                                setCurrentOrderItems(prev => prev.map(item => item.cartItemId === id ? { ...item, quantity: qty } : item).filter(i => i.quantity > 0));
                                            }}
                                            onRemoveItem={(id) => setCurrentOrderItems(prev => prev.filter(i => i.cartItemId !== id))}
                                            onClearOrder={() => setCurrentOrderItems([])}
                                            onPlaceOrder={handlePlaceOrder}
                                            isPlacingOrder={isPlacingOrder}
                                            tables={tables}
                                            selectedTable={tables.find(t => t.id === selectedTableId) || null}
                                            onSelectTable={setSelectedTableId}
                                            customerName={customerName}
                                            onCustomerNameChange={setCustomerName}
                                            customerCount={customerCount}
                                            onCustomerCountChange={setCustomerCount}
                                            isEditMode={isEditMode}
                                            onAddNewTable={handleAddNewTable}
                                            onRemoveLastTable={handleRemoveLastTable}
                                            floors={floors}
                                            selectedFloor={selectedSidebarFloor}
                                            onFloorChange={setSelectedSidebarFloor}
                                            onAddFloor={handleAddFloor}
                                            onRemoveFloor={handleRemoveFloor}
                                            sendToKitchen={sendToKitchen}
                                            onSendToKitchenChange={(val, details) => { setSendToKitchen(val); setNotSentToKitchenDetails(details); }}
                                            onUpdateReservation={() => {}}
                                            onOpenSearch={() => setModalState(prev => ({ ...prev, isMenuSearch: true }))}
                                            currentUser={currentUser}
                                            onEditOrderItem={(item) => { setOrderItemToEdit(item); setModalState(prev => ({ ...prev, isCustomization: true })); }}
                                            onViewChange={setCurrentView}
                                            restaurantName={restaurantName}
                                            onLogout={handleLogout}
                                            onToggleAvailability={handleToggleAvailability}
                                            isOrderNotificationsEnabled={isOrderNotificationsEnabled}
                                            onToggleOrderNotifications={toggleOrderNotifications}
                                            deliveryProviders={deliveryProviders}
                                            onToggleEditMode={() => setIsEditMode(!isEditMode)}
                                            onOpenSettings={() => setModalState(prev => ({ ...prev, isSettings: true }))}
                                        />
                                    )}
                                </aside>
                            )}

                            {/* Mobile Sidebar (Overlay) */}
                            {!isDesktop && isOrderSidebarVisible && (
                                <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col animate-slide-up">
                                    <div className="p-3 bg-gray-800 border-b border-gray-700 flex justify-between items-center text-white shrink-0">
                                        <h2 className="font-bold text-lg flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                            รายการที่เลือก ({totalCartItemCount})
                                        </h2>
                                        <button onClick={() => setIsOrderSidebarVisible(false)} className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 text-white">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <Sidebar
                                            currentOrderItems={currentOrderItems}
                                            onQuantityChange={(id, qty) => {
                                                setCurrentOrderItems(prev => prev.map(item => item.cartItemId === id ? { ...item, quantity: qty } : item).filter(i => i.quantity > 0));
                                            }}
                                            onRemoveItem={(id) => setCurrentOrderItems(prev => prev.filter(i => i.cartItemId !== id))}
                                            onClearOrder={() => setCurrentOrderItems([])}
                                            onPlaceOrder={handlePlaceOrder}
                                            isPlacingOrder={isPlacingOrder}
                                            tables={tables}
                                            selectedTable={tables.find(t => t.id === selectedTableId) || null}
                                            onSelectTable={setSelectedTableId}
                                            customerName={customerName}
                                            onCustomerNameChange={setCustomerName}
                                            customerCount={customerCount}
                                            onCustomerCountChange={setCustomerCount}
                                            isEditMode={isEditMode}
                                            onAddNewTable={handleAddNewTable}
                                            onRemoveLastTable={handleRemoveLastTable}
                                            floors={floors}
                                            selectedFloor={selectedSidebarFloor}
                                            onFloorChange={setSelectedSidebarFloor}
                                            onAddFloor={handleAddFloor}
                                            onRemoveFloor={handleRemoveFloor}
                                            sendToKitchen={sendToKitchen}
                                            onSendToKitchenChange={(val, details) => { setSendToKitchen(val); setNotSentToKitchenDetails(details); }}
                                            onUpdateReservation={() => {}}
                                            onOpenSearch={() => setModalState(prev => ({ ...prev, isMenuSearch: true }))}
                                            currentUser={currentUser}
                                            onEditOrderItem={(item) => { setOrderItemToEdit(item); setModalState(prev => ({ ...prev, isCustomization: true })); }}
                                            onViewChange={setCurrentView}
                                            restaurantName={restaurantName}
                                            onLogout={handleLogout}
                                            onToggleAvailability={handleToggleAvailability}
                                            isOrderNotificationsEnabled={isOrderNotificationsEnabled}
                                            onToggleOrderNotifications={toggleOrderNotifications}
                                            deliveryProviders={deliveryProviders}
                                            onToggleEditMode={() => setIsEditMode(!isEditMode)}
                                            onOpenSettings={() => setModalState(prev => ({ ...prev, isSettings: true }))}
                                            isMobilePage={true}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Mobile Floating Cart Button */}
                            {!isDesktop && !isOrderSidebarVisible && totalCartItemCount > 0 && (
                                <div className="absolute bottom-4 left-4 right-4 z-30">
                                    <button 
                                        onClick={() => setIsOrderSidebarVisible(true)}
                                        className="w-full bg-blue-600 text-white shadow-xl rounded-xl p-4 flex justify-between items-center animate-bounce-in"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="bg-white text-blue-600 font-bold w-8 h-8 rounded-full flex items-center justify-center text-lg">{totalCartItemCount}</span>
                                            <div className="text-left leading-tight">
                                                <span className="font-bold text-lg block">ดูรายการ</span>
                                                <span className="text-xs font-light text-blue-100">แตะเพื่อสรุปยอด</span>
                                            </div>
                                        </div>
                                        <span className="font-bold text-xl">
                                            {currentOrderItems.reduce((acc, item) => acc + item.finalPrice * item.quantity, 0).toLocaleString()} ฿
                                        </span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    {currentView === 'kitchen' && (
                        <Suspense fallback={<PageLoading />}>
                            <KitchenView 
                                activeOrders={activeOrders} 
                                onCompleteOrder={async (orderId) => {
                                    // "BUMP" means served/completed from kitchen view. 
                                    await activeOrdersActions.update(orderId, { status: 'served' });
                                }} 
                                onStartCooking={async (orderId) => {
                                    await activeOrdersActions.update(orderId, { 
                                        status: 'cooking',
                                        cookingStartTime: Date.now()
                                    });
                                }} 
                                onPrintOrder={async (orderId) => {
                                    const order = activeOrders.find(o => o.id === orderId);
                                    if (!order) return;
                                    
                                    if (!printerConfig?.kitchen?.ipAddress) {
                                         Swal.fire({
                                            icon: 'warning',
                                            title: 'ไม่ได้ตั้งค่าเครื่องพิมพ์',
                                            text: 'กรุณาตั้งค่าเครื่องพิมพ์ครัวในเมนูตั้งค่าก่อน',
                                            timer: 2000,
                                            showConfirmButton: false
                                        });
                                        return;
                                    }

                                    try {
                                        Swal.fire({
                                            title: 'กำลังส่งคำสั่งพิมพ์...',
                                            didOpen: () => { Swal.showLoading(); }
                                        });
                                        await printerService.printKitchenOrder(order, printerConfig.kitchen);
                                        Swal.close();
                                        Swal.fire({
                                            icon: 'success',
                                            title: 'ส่งพิมพ์เรียบร้อย',
                                            toast: true,
                                            position: 'top-end',
                                            showConfirmButton: false,
                                            timer: 1500
                                        });
                                    } catch (error: any) {
                                        Swal.close();
                                        Swal.fire({
                                            icon: 'error',
                                            title: 'พิมพ์ไม่สำเร็จ',
                                            text: error.message
                                        });
                                    }
                                }} 
                                isAutoPrintEnabled={isAutoPrintEnabled} 
                                onToggleAutoPrint={toggleAutoPrint} 
                            />
                        </Suspense>
                    )}
                    {currentView === 'tables' && (
                        <TableLayout
                            tables={tables}
                            activeOrders={activeOrders}
                            onTableSelect={setSelectedTableId}
                            onShowBill={(orderId) => {
                                const order = activeOrders.find(o => o.id === orderId);
                                if (order) {
                                    setOrderForModal(order);
                                    setModalState(prev => ({ ...prev, isTableBill: true }));
                                }
                            }}
                            onGeneratePin={() => {}}
                            currentUser={currentUser}
                            printerConfig={printerConfig}
                            floors={floors}
                            selectedBranch={selectedBranch}
                            restaurantName={restaurantName}
                            logoUrl={logoUrl}
                        />
                    )}
                    {currentView === 'dashboard' && (
                        <Suspense fallback={<PageLoading />}>
                            <Dashboard 
                                completedOrders={completedOrders} 
                                cancelledOrders={cancelledOrders} 
                                openingTime={openingTime || '10:00'} 
                                closingTime={closingTime || '22:00'} 
                                currentUser={currentUser} 
                            />
                        </Suspense>
                    )}
                    {currentView === 'history' && (
                        <Suspense fallback={<PageLoading />}>
                            <SalesHistory 
                                completedOrders={completedOrders} 
                                cancelledOrders={cancelledOrders} 
                                printHistory={printHistory} 
                                onReprint={() => {}} 
                                onSplitOrder={(order) => { setOrderForModal(order); setModalState(prev => ({ ...prev, isSplitCompleted: true })); }} 
                                isEditMode={isEditMode} 
                                onEditOrder={(order) => { setOrderForModal(order); setModalState(prev => ({ ...prev, isEditCompleted: true })); }} 
                                onInitiateCashBill={(order) => { setOrderForModal(order); setModalState(prev => ({ ...prev, isCashBill: true })); }} 
                                onDeleteHistory={handleDeleteHistory} 
                                currentUser={currentUser} 
                                onReprintReceipt={() => {}} 
                            />
                        </Suspense>
                    )}
                    {/* ... other views ... */}
                    {currentView === 'stock' && (
                        <Suspense fallback={<PageLoading />}>
                            <StockManagement 
                                stockItems={stockItems} 
                                setStockItems={setStockItems} 
                                stockCategories={stockCategories} 
                                setStockCategories={setStockCategories} 
                                stockUnits={stockUnits} 
                                setStockUnits={setStockUnits} 
                                currentUser={currentUser} 
                            />
                        </Suspense>
                    )}
                    {currentView === 'leave' && (
                        <Suspense fallback={<PageLoading />}>
                            <LeaveCalendarView 
                                leaveRequests={leaveRequests} 
                                currentUser={currentUser} 
                                onOpenRequestModal={(date) => { setLeaveRequestInitialDate(date || null); setModalState(prev => ({ ...prev, isLeaveRequest: true })); }} 
                                branches={branches} 
                                onUpdateStatus={() => {}} 
                                onDeleteRequest={async () => true} 
                                selectedBranch={selectedBranch} 
                            />
                        </Suspense>
                    )}
                    {currentView === 'maintenance' && (
                        <Suspense fallback={<PageLoading />}>
                            <MaintenanceView 
                                maintenanceItems={maintenanceItems} 
                                setMaintenanceItems={setMaintenanceItems} 
                                maintenanceLogs={maintenanceLogs} 
                                setMaintenanceLogs={setMaintenanceLogs} 
                                currentUser={currentUser} 
                                isEditMode={isEditMode} 
                            />
                        </Suspense>
                    )}
                    {currentView === 'stock-analytics' && (
                        <Suspense fallback={<PageLoading />}>
                            <StockAnalytics stockItems={stockItems} />
                        </Suspense>
                    )}
                    {currentView === 'leave-analytics' && (
                        <Suspense fallback={<PageLoading />}>
                            <LeaveAnalytics leaveRequests={leaveRequests} users={users} />
                        </Suspense>
                    )}
                </main>
            </div>
            
            {!isDesktop && currentUser && <BottomNavBar items={mobileNavItems} currentView={currentView} onViewChange={setCurrentView} />}

            {/* Modals - Kept same as previous */}
            <LoginModal isOpen={false} onClose={() => {}} />
            <MenuItemModal isOpen={modalState.isMenuItem} onClose={handleModalClose} onSave={handleSaveMenuItem} itemToEdit={itemToEdit} categories={categories} onAddCategory={handleAddCategory} />
            <OrderSuccessModal isOpen={modalState.isOrderSuccess} onClose={handleModalClose} orderNumber={lastPlacedOrderNumber!} />
            <SplitBillModal isOpen={modalState.isSplitBill} order={orderForModal as ActiveOrder | null} onClose={handleModalClose} onConfirmSplit={handleConfirmSplit} />
            <TableBillModal 
                isOpen={modalState.isTableBill} 
                onClose={handleModalClose} 
                order={orderForModal as ActiveOrder | null} 
                onInitiatePayment={(order) => { setOrderForModal(order); setModalState(prev => ({...prev, isPayment: true, isTableBill: false})); }} 
                onInitiateMove={(order) => {setOrderForModal(order); setModalState(prev => ({...prev, isMoveTable: true, isTableBill: false})); }} 
                onSplit={(order) => {setOrderForModal(order); setModalState(prev => ({...prev, isSplitBill: true, isTableBill: false})); }} 
                onUpdateOrder={(id, items, count) => handleUpdateOrderFromModal(id, items, count)}
                isEditMode={isEditMode} 
                currentUser={currentUser} 
                onInitiateCancel={(order) => {setOrderForModal(order); setModalState(prev => ({...prev, isCancelOrder: true, isTableBill: false}))}} 
                activeOrders={activeOrders} 
                onInitiateMerge={(order) => {setOrderForModal(order); setModalState(prev => ({...prev, isMergeBill: true, isTableBill: false}))}}
                onMergeAndPay={handleMergeAndPay}
            />
            <PaymentModal isOpen={modalState.isPayment} order={orderForModal as ActiveOrder | null} onClose={handleModalClose} onConfirmPayment={handleConfirmPayment} qrCodeUrl={qrCodeUrl} isEditMode={isEditMode} onOpenSettings={() => setModalState(prev => ({...prev, isSettings: true}))} isConfirmingPayment={isConfirmingPayment} />
            <PaymentSuccessModal isOpen={modalState.isPaymentSuccess} onClose={handlePaymentSuccessClose} orderNumber={(orderForModal as CompletedOrder)?.orderNumber || 0} />
            
            <Suspense fallback={null}>
                <SettingsModal 
                    isOpen={modalState.isSettings} 
                    onClose={handleModalClose} 
                    onSave={(newLogo, newAppLogo, qr, sound, staffSound, printer, open, close, address, phone, tax, signature) => { 
                        setLogoUrl(newLogo); 
                        setAppLogoUrl(newAppLogo); 
                        setQrCodeUrl(qr); 
                        setNotificationSoundUrl(sound); 
                        setStaffCallSoundUrl(staffSound); 
                        setPrinterConfig(printer); 
                        setOpeningTime(open); 
                        setClosingTime(close); 
                        setRestaurantAddress(address);
                        setRestaurantPhone(phone);
                        setTaxId(tax);
                        setSignatureUrl(signature);
                        handleModalClose(); 
                    }} 
                    currentLogoUrl={logoUrl} 
                    currentAppLogoUrl={appLogoUrl} 
                    currentQrCodeUrl={qrCodeUrl} 
                    currentNotificationSoundUrl={notificationSoundUrl} 
                    currentStaffCallSoundUrl={staffCallSoundUrl} 
                    currentPrinterConfig={printerConfig} 
                    currentOpeningTime={openingTime} 
                    currentClosingTime={closingTime} 
                    onSavePrinterConfig={setPrinterConfig} 
                    menuItems={menuItems} 
                    currentRecommendedMenuItemIds={recommendedMenuItemIds} 
                    onSaveRecommendedItems={setRecommendedMenuItemIds} 
                    deliveryProviders={deliveryProviders} 
                    onSaveDeliveryProviders={setDeliveryProviders}
                    currentRestaurantAddress={restaurantAddress}
                    currentRestaurantPhone={restaurantPhone}
                    currentTaxId={taxId}
                    currentSignatureUrl={signatureUrl}
                />
            </Suspense>

            <EditCompletedOrderModal isOpen={modalState.isEditCompleted} order={orderForModal as CompletedOrder | null} onClose={handleModalClose} onSave={async ({id, items}) => { if(newCompletedOrders.some(o => o.id === id)) { await newCompletedOrdersActions.update(id, { items }); } else { setLegacyCompletedOrders(prev => prev.map(o => o.id === id ? {...o, items} : o)); } }} menuItems={menuItems} />
            <UserManagerModal isOpen={modalState.isUserManager} onClose={handleModalClose} users={users} setUsers={setUsers} currentUser={currentUser!} branches={branches} isEditMode={isEditMode} tables={tables} />
            <BranchManagerModal isOpen={modalState.isBranchManager} onClose={handleModalClose} branches={branches} setBranches={setBranches} currentUser={currentUser} />
            <MoveTableModal isOpen={modalState.isMoveTable} onClose={handleModalClose} order={orderForModal as ActiveOrder | null} tables={tables} activeOrders={activeOrders} onConfirmMove={handleConfirmMoveTable} floors={floors} />
            <CancelOrderModal isOpen={modalState.isCancelOrder} onClose={handleModalClose} order={orderForModal as ActiveOrder | null} onConfirm={handleConfirmCancelOrder} />
            <CashBillModal 
                isOpen={modalState.isCashBill} 
                order={orderForModal as CompletedOrder | null} 
                onClose={handleModalClose} 
                restaurantName={restaurantName} 
                logoUrl={logoUrl}
                restaurantAddress={restaurantAddress}
                restaurantPhone={restaurantPhone}
                taxId={taxId}
                signatureUrl={signatureUrl}
                menuItems={menuItems}
                printerConfig={printerConfig}
            />
            <SplitCompletedBillModal isOpen={modalState.isSplitCompleted} order={orderForModal as CompletedOrder | null} onClose={handleModalClose} onConfirmSplit={() => {}} />
            <ItemCustomizationModal isOpen={modalState.isCustomization} onClose={handleModalClose} item={itemToCustomize} onConfirm={handleConfirmCustomization} orderItemToEdit={orderItemToEdit} />
            <LeaveRequestModal isOpen={modalState.isLeaveRequest} onClose={handleModalClose} currentUser={currentUser} onSave={(req) => {const newId = Math.max(0, ...leaveRequests.map(r => r.id)) + 1; setLeaveRequests(prev => [...prev, {...req, id: newId, status: 'pending', branchId: selectedBranch!.id, submittedAt: Date.now()}]); handleModalClose(); }} leaveRequests={leaveRequests} initialDate={leaveRequestInitialDate} />
            <MenuSearchModal isOpen={modalState.isMenuSearch} onClose={handleModalClose} menuItems={menuItems} onSelectItem={handleAddItemToOrder} onToggleAvailability={handleToggleAvailability} />
            <MergeBillModal isOpen={modalState.isMergeBill} onClose={handleModalClose} order={orderForModal as ActiveOrder} allActiveOrders={activeOrders} tables={tables} onConfirmMerge={handleMergeAndPay} />
        </div>
    );
};

export default App;