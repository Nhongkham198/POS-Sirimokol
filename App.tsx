
import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';

import { 
    DEFAULT_BRANCHES, 
    DEFAULT_CATEGORIES, 
    DEFAULT_MENU_ITEMS, 
    DEFAULT_TABLES, 
    DEFAULT_USERS, 
    DEFAULT_STOCK_CATEGORIES, 
    DEFAULT_STOCK_UNITS, 
    DEFAULT_STOCK_ITEMS, 
    DEFAULT_FLOORS, 
    DEFAULT_MAINTENANCE_ITEMS,
    DEFAULT_DELIVERY_PROVIDERS
} from './constants';
// ... types import
import type { 
    MenuItem, 
    OrderItem, 
    Table, 
    ActiveOrder, 
    User, 
    CompletedOrder, 
    CancelledOrder, 
    PrinterConfig, 
    Branch, 
    StockItem, 
    View, 
    NavItem, 
    PrintHistoryEntry, 
    TakeawayCutleryOption, 
    Reservation, 
    LeaveRequest, 
    StaffCall, 
    PaymentDetails, 
    CancellationReason, 
    OrderCounter,
    MaintenanceItem,
    MaintenanceLog,
    DeliveryProvider
} from './types';
import { useFirestoreSync, useFirestoreCollection } from './hooks/useFirestoreSync';
import { functionsService } from './services/firebaseFunctionsService';
import { printerService } from './services/printerService';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/messaging';
import { isFirebaseConfigured, db } from './firebaseConfig';

import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Menu } from './components/Menu';
// Lazy load heavy components
const KitchenView = React.lazy(() => import('./components/KitchenView').then(module => ({ default: module.KitchenView })));
const TableLayout = React.lazy(() => import('./components/TableLayout').then(module => ({ default: module.TableLayout })));
const Dashboard = React.lazy(() => import('./components/Dashboard').then(module => ({ default: module.Dashboard })));
const SalesHistory = React.lazy(() => import('./components/SalesHistory').then(module => ({ default: module.SalesHistory })));
const StockManagement = React.lazy(() => import('./components/StockManagement').then(module => ({ default: module.StockManagement })));
const StockAnalytics = React.lazy(() => import('./components/StockAnalytics').then(module => ({ default: module.StockAnalytics })));
const LeaveCalendarView = React.lazy(() => import('./components/LeaveCalendarView').then(module => ({ default: module.LeaveCalendarView })));
const LeaveAnalytics = React.lazy(() => import('./components/LeaveAnalytics').then(module => ({ default: module.LeaveAnalytics })));
const AdminSidebar = React.lazy(() => import('./components/AdminSidebar')); // Default export
const MaintenanceView = React.lazy(() => import('./components/MaintenanceView').then(module => ({ default: module.MaintenanceView })));
const CustomerView = React.lazy(() => import('./components/CustomerView').then(module => ({ default: module.CustomerView })));
const QueueDisplay = React.lazy(() => import('./components/QueueDisplay').then(module => ({ default: module.QueueDisplay })));


import { BottomNavBar } from './components/BottomNavBar';

import { LoginScreen } from './components/LoginScreen';
import { BranchSelectionScreen } from './components/BranchSelectionScreen';
import { LoginModal } from './components/LoginModal';
import { MenuItemModal } from './components/MenuItemModal';
import { OrderSuccessModal } from './components/OrderSuccessModal';
import { OrderTimeoutModal } from './components/OrderTimeoutModal';
import { SplitBillModal } from './components/SplitBillModal';
import { SplitCompletedBillModal } from './components/SplitCompletedBillModal';
import { TableBillModal } from './components/TableBillModal';
import { PaymentModal } from './components/PaymentModal';
import { PaymentSuccessModal } from './components/PaymentSuccessModal';
// Lazy load heavy settings modal
const SettingsModal = React.lazy(() => import('./components/SettingsModal').then(module => ({ default: module.SettingsModal })));
import { EditCompletedOrderModal } from './components/EditCompletedOrderModal';
import { UserManagerModal } from './components/UserManagerModal';
import { BranchManagerModal } from './components/BranchManagerModal';
import { MoveTableModal } from './components/MoveTableModal';
import { CancelOrderModal } from './components/CancelOrderModal';
import { CashBillModal } from './components/CashBillModal';
import { ItemCustomizationModal } from './components/ItemCustomizationModal';
import { LeaveRequestModal } from './components/LeaveRequestModal';
import { MenuSearchModal } from './components/MenuSearchModal';
import { MergeBillModal } from './components/MergeBillModal';

import Swal from 'sweetalert2';
import type { SubmitLeaveRequestPayload, PlaceOrderPayload } from './services/firebaseFunctionsService';

declare global {
    interface Window {
        AndroidBridge?: {
            setPendingOrderCount: (count: number) => void;
        };
    }
}

// Loading Spinner Component
const PageLoading = () => (
    <div className="h-full w-full flex flex-col items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mb-4"></div>
        <p className="text-gray-500 font-medium">กำลังโหลด...</p>
    </div>
);

export const App: React.FC = () => {
    // 1. STATE INITIALIZATION
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // --- AUTH & BRANCH STATE ---
    const [users, setUsers] = useFirestoreSync<User[]>(null, 'users', DEFAULT_USERS);
    const [branches, setBranches] = useFirestoreSync<Branch[]>(null, 'branches', DEFAULT_BRANCHES);
    
    // Load currentUser from localStorage carefully
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
                    console.error('Error parsing customer branch from localStorage', e);
                    localStorage.removeItem('customerSelectedBranch');
                }
            }
        }
        
        const staffBranch = localStorage.getItem('selectedBranch');
        if (staffBranch) {
            try {
                return JSON.parse(staffBranch);
            } catch (e) {
                console.error('Error parsing staff branch from localStorage', e);
                localStorage.removeItem('selectedBranch');
            }
        }

        return null;
    });
    const [currentFcmToken, setCurrentFcmToken] = useState<string | null>(null);

    // --- VIEW & EDIT MODE STATE ---
    const [currentView, setCurrentView] = useState<View>(() => {
        const storedView = localStorage.getItem('currentView');
        if (storedView && ['pos', 'kitchen', 'tables', 'dashboard', 'history', 'stock', 'leave', 'stock-analytics', 'leave-analytics', 'maintenance'].includes(storedView)) {
            return storedView as View;
        }
        return 'pos';
    });
    const [isEditMode, setIsEditMode] = useState(false);
    const [isAdminSidebarCollapsed, setIsAdminSidebarCollapsed] = useState(false);
    const [isOrderSidebarVisible, setIsOrderSidebarVisible] = useState(true);

    // --- NOTIFICATION TOGGLE STATE ---
    const [isOrderNotificationsEnabled, setIsOrderNotificationsEnabled] = useState(() => {
        return localStorage.getItem('isOrderNotificationsEnabled') === 'true';
    });

    const toggleOrderNotifications = () => {
        setIsOrderNotificationsEnabled(prev => {
            const newValue = !prev;
            localStorage.setItem('isOrderNotificationsEnabled', String(newValue));
            return newValue;
        });
    };

    // --- AUTO PRINT TOGGLE STATE ---
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
    
    // --- SPECIAL DISPLAY MODES ---
    const [isQueueMode, setIsQueueMode] = useState(() => window.location.pathname === '/queue');

    // --- CUSTOMER MODE STATE ---
    const [isCustomerMode, setIsCustomerMode] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('mode') === 'customer') return true;
        
        // Check persisted user role from localStorage directly to ensure stability on refresh
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
        
        // Check persisted user assignment
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
    
    // --- BRANCH-SPECIFIC STATE (SYNCED WITH FIRESTORE) ---
    const urlBranchId = useMemo(() => new URLSearchParams(window.location.search).get('branchId'), []);
    const branchId = selectedBranch ? selectedBranch.id.toString() : (isCustomerMode || isQueueMode) && urlBranchId ? urlBranchId : null;


    // OPTIMIZATION: Determine if we should load heavy admin data (History, Stock, Maintenance)
    // We only load this if the user is NOT a customer (role != 'table') AND not in customer mode.
    const shouldLoadHeavyData = useMemo(() => {
        return currentUser && currentUser.role !== 'table' && !isCustomerMode;
    }, [currentUser, isCustomerMode]);

    // Use this ID for heavy hooks. If null, the hook skips loading.
    const heavyDataBranchId = shouldLoadHeavyData ? branchId : null;

    // Effect to hydrate selectedBranch from URL if missing (for Customer & Queue Mode)
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
    const [menuItems, setMenuItems] = useFirestoreSync<MenuItem[]>(branchId, 'menuItems', DEFAULT_MENU_ITEMS);
    const [categories, setCategories] = useFirestoreSync<string[]>(branchId, 'categories', DEFAULT_CATEGORIES);
    const [tables, setTables] = useFirestoreSync<Table[]>(branchId, 'tables', DEFAULT_TABLES);
    const [floors, setFloors] = useFirestoreSync<string[]>(branchId, 'floors', DEFAULT_FLOORS);
    const [recommendedMenuItemIds, setRecommendedMenuItemIds] = useFirestoreSync<number[]>(branchId, 'recommendedMenuItemIds', []);
    
    // Active Orders: Needed for customers to see queue position and own orders
    const [rawActiveOrders, activeOrdersActions] = useFirestoreCollection<ActiveOrder>(branchId, 'activeOrders');
    
    const activeOrders = useMemo(() => {
        return rawActiveOrders.filter(o => o.status !== 'completed' && o.status !== 'cancelled');
    }, [rawActiveOrders]);

    // --- HEAVY DATA (Loaded ONLY for Staff/Admin - via heavyDataBranchId) ---
    
    // History
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

    // Stock
    const [stockItems, setStockItems] = useFirestoreSync<StockItem[]>(heavyDataBranchId, 'stockItems', DEFAULT_STOCK_ITEMS);
    const [stockCategories, setStockCategories] = useFirestoreSync<string[]>(heavyDataBranchId, 'stockCategories', DEFAULT_STOCK_CATEGORIES);
    const [stockUnits, setStockUnits] = useFirestoreSync<string[]>(heavyDataBranchId, 'stockUnits', DEFAULT_STOCK_UNITS);
    
    // Maintenance & Logs
    const [printHistory, setPrintHistory] = useFirestoreSync<PrintHistoryEntry[]>(heavyDataBranchId, 'printHistory', []);
    const [maintenanceItems, setMaintenanceItems] = useFirestoreSync<MaintenanceItem[]>(heavyDataBranchId, 'maintenanceItems', DEFAULT_MAINTENANCE_ITEMS);
    const [maintenanceLogs, setMaintenanceLogs] = useFirestoreSync<MaintenanceLog[]>(heavyDataBranchId, 'maintenanceLogs', []);
    
    // Order Counter (For Dashboard stats primarily)
    const [orderCounter, setOrderCounter] = useFirestoreSync<OrderCounter>(heavyDataBranchId, 'orderCounter', { count: 0, lastResetDate: new Date().toISOString().split('T')[0] });

    // Staff Calls & Leave Requests (Keep separate for now, lightweight enough to load on branchId or specialized logic)
    // Note: Staff Calls are needed for Staff to RECEIVE. Customers SEND. Customers don't need to load the list.
    // For now, we leave staffCalls on branchId so the setter works for customers to send calls.
    const [staffCalls, setStaffCalls] = useFirestoreSync<StaffCall[]>(branchId, 'staffCalls', []);
    
    // Leave Requests are typically global or filtered by branch. 
    // Optimization: Only load if Staff/Admin.
    const [leaveRequests, setLeaveRequests] = useFirestoreSync<LeaveRequest[]>(shouldLoadHeavyData ? null : 'SKIP', 'leaveRequests', []);

    // --- POS-SPECIFIC LOCAL STATE ---
    const [currentOrderItems, setCurrentOrderItems] = useState<OrderItem[]>([]);
    const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
    const [customerName, setCustomerName] = useState('');
    const [customerCount, setCustomerCount] = useState(1);
    const [selectedSidebarFloor, setSelectedSidebarFloor] = useState<string>('');
    const [notSentToKitchenDetails, setNotSentToKitchenDetails] = useState<{ reason: string; notes: string } | null>(null);

    // --- GENERAL SETTINGS STATE (Essential for everyone for Logo/Name/Rules) ---
    // NOTE: In updated useFirestoreSync, appLogoUrl, logoUrl, restaurantName are GLOBAL.
    // This allows them to load even when branchId is null (at login).
    const [logoUrl, setLogoUrl] = useFirestoreSync<string | null>(branchId, 'logoUrl', null);
    const [appLogoUrl, setAppLogoUrl] = useFirestoreSync<string | null>(branchId, 'appLogoUrl', null);
    const [restaurantName, setRestaurantName] = useFirestoreSync<string>(branchId, 'restaurantName', 'ชื่อร้านอาหาร');
    const [restaurantAddress, setRestaurantAddress] = useFirestoreSync<string>(branchId, 'restaurantAddress', '');
    const [restaurantPhone, setRestaurantPhone] = useFirestoreSync<string>(branchId, 'restaurantPhone', '');
    const [taxId, setTaxId] = useFirestoreSync<string>(branchId, 'taxId', '');
    const [signatureUrl, setSignatureUrl] = useFirestoreSync<string | null>(branchId, 'signatureUrl', null);

    const [qrCodeUrl, setQrCodeUrl] = useFirestoreSync<string | null>(branchId, 'qrCodeUrl', null);
    const [notificationSoundUrl, setNotificationSoundUrl] = useFirestoreSync<string | null>(branchId, 'notificationSoundUrl', null);
    const [staffCallSoundUrl, setStaffCallSoundUrl] = useFirestoreSync<string | null>(branchId, 'staffCallSoundUrl', null);
    const [printerConfig, setPrinterConfig] = useFirestoreSync<PrinterConfig | null>(branchId, 'printerConfig', null);
    const [openingTime, setOpeningTime] = useFirestoreSync<string | null>(branchId, 'openingTime', '10:00');
    const [closingTime, setClosingTime] = useFirestoreSync<string | null>(branchId, 'closingTime', '22:00');
    const [isTaxEnabled, setIsTaxEnabled] = useFirestoreSync<boolean>(branchId, 'isTaxEnabled', false);
    const [taxRate, setTaxRate] = useFirestoreSync<number>(branchId, 'taxRate', 7);
    const [sendToKitchen, setSendToKitchen] = useFirestoreSync<boolean>(branchId, 'sendToKitchen', true);
    const [deliveryProviders, setDeliveryProviders] = useFirestoreSync<DeliveryProvider[]>(branchId, 'deliveryProviders', DEFAULT_DELIVERY_PROVIDERS);

    // --- MODAL STATES ---
    const [modalState, setModalState] = useState({
        isMenuItem: false, isOrderSuccess: false, isSplitBill: false, isTableBill: false,
        isPayment: false, isPaymentSuccess: false, isSettings: false, isEditCompleted: false,
        isUserManager: false, isBranchManager: false, isMoveTable: false, isCancelOrder: false,
        isCashBill: false, isSplitCompleted: false, isCustomization: false, isLeaveRequest: false,
        isMenuSearch: false, isMergeBill: false
    });
    const [itemToEdit, setItemToEdit] = useState<MenuItem | null>(null);
    const [itemToCustomize, setItemToCustomize] = useState<MenuItem | null>(null);
    const [orderItemToEdit, setOrderItemToEdit] = useState<OrderItem | null>(null); 
    const [orderForModal, setOrderForModal] = useState<ActiveOrder | CompletedOrder | null>(null);
    const [lastPlacedOrderId, setLastPlacedOrderId] = useState<number | null>(null);
    const [leaveRequestInitialDate, setLeaveRequestInitialDate] = useState<Date | null>(null);

    // --- ASYNC OPERATION STATE ---
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
    const [isCachingImages, setIsCachingImages] = useState(false);
    const imageCacheTriggeredRef = useRef(false);
    const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);

    // --- REFS ---
    const prevActiveOrdersRef = useRef<ActiveOrder[] | undefined>(undefined);
    const staffCallAudioRef = useRef<HTMLAudioElement | null>(null);
    const prevUserRef = useRef<User | null>(null);
    const activeCallRef = useRef<StaffCall | null>(null);
    const overdueTimersRef = useRef<Map<number, number>>(new Map());
    const shownNotificationsRef = useRef<Set<number>>(new Set());
    const mountTimeRef = useRef(Date.now());
    const notifiedLowStockRef = useRef<Set<number>>(new Set());
    const notifiedDailyStockRef = useRef<string>('');
    const notifiedMaintenanceRef = useRef<Set<number>>(new Set());
    // Ref to track processed auto-prints to avoid duplication
    // const autoPrintProcessedIds = useRef<Set<number>>(new Set()); // REPLACED
    // NEW: Ref to track the latest staff call time to prevent duplicate alerts on refresh
    const latestStaffCallTimeRef = useRef(Date.now());
    // NEW: Ref to track active orders for change detection (better auto print)
    const prevOrdersForAutoPrint = useRef<ActiveOrder[] | null>(null);
    // NEW: Ref to track max leave request ID to detect new ones
    const maxKnownLeaveIdRef = useRef<number>(-1);

    // ... Computed Values ... (Same as before)
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

    // ... Effects ... (Online, Resize, Sound Cache, Overdue, Low Stock, Maintenance)
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => { setIsOnline(false); Swal.fire({ icon: 'warning', title: 'ขาดการเชื่อมต่อ', text: 'อินเทอร์เน็ตของคุณหลุด ระบบจะป้องกันการบันทึกข้อมูลเพื่อความปลอดภัย กรุณาตรวจสอบอินเทอร์เน็ต', toast: true, position: 'top-end', showConfirmButton: false, timer: 5000 }); };
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
    }, []);
    
    // Ensure table users always stay in customer mode
    useEffect(() => {
        if (currentUser?.role === 'table') {
            setIsCustomerMode(true);
            if (currentUser.assignedTableId) {
                setCustomerTableId(currentUser.assignedTableId);
            }
        }
    }, [currentUser]);

    useEffect(() => {
        if (!isOnline) return;
        activeOrders.forEach(order => {
            if (order.orderType === 'lineman') return;
            const realTable = tables.find(t => t.id === order.tableId);
            if (realTable && (realTable.floor !== order.floor || realTable.name !== order.tableName)) {
                activeOrdersActions.update(order.id, { floor: realTable.floor, tableName: realTable.name });
            }
        });
    }, [activeOrders, tables, isOnline]);
    useEffect(() => { const handleResize = () => setIsDesktop(window.innerWidth >= 1024); window.addEventListener('resize', handleResize); return () => window.removeEventListener('resize', handleResize); }, []);
    useEffect(() => { if ('serviceWorker' in navigator && navigator.serviceWorker.controller) { const soundsToCache = []; if (notificationSoundUrl) soundsToCache.push(notificationSoundUrl); if (staffCallSoundUrl) soundsToCache.push(staffCallSoundUrl); if (soundsToCache.length > 0) { soundsToCache.forEach(url => fetch(url, { mode: 'no-cors' }).catch(() => {})); } } }, [notificationSoundUrl, staffCallSoundUrl]);
    
    // ... Notifications ...
    useEffect(() => {
        if (prevActiveOrdersRef.current === undefined) { prevActiveOrdersRef.current = activeOrders; return; }
        const shouldNotify = (currentUser?.role === 'kitchen' || isOrderNotificationsEnabled) && notificationSoundUrl && isAudioUnlocked;
        if (!shouldNotify) { prevActiveOrdersRef.current = activeOrders; return; }
        const newOrders = activeOrders.filter(order => !prevActiveOrdersRef.current!.some(prevOrder => prevOrder.id === order.id) && order.id > mountTimeRef.current && order.tableName && order.orderNumber );
        if (newOrders.length > 0) {
            const audio = new Audio(notificationSoundUrl!);
            audio.play().catch(() => {});
            newOrders.forEach(order => {
                Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: '🔔 มีออเดอร์ใหม่!', html: `<b>โต๊ะ ${order.tableName}</b> (ออเดอร์ #${String(order.orderNumber).padStart(3, '0')})`, showConfirmButton: true, confirmButtonText: 'ไปที่หน้าครัว', timer: 10000, timerProgressBar: true, }).then((result) => { if (result.isConfirmed) setCurrentView('kitchen'); });
            });
        }
        prevActiveOrdersRef.current = activeOrders;
    }, [activeOrders, currentUser, notificationSoundUrl, isAudioUnlocked, isOrderNotificationsEnabled]);

    // NEW: Staff Call Notification Watcher
    useEffect(() => {
        // Filter for calls that happened AFTER the app was loaded (or last checked)
        // This prevents alerting for old calls stored in the database when refreshing the page
        const newCalls = staffCalls.filter(call => call.timestamp > latestStaffCallTimeRef.current);

        if (newCalls.length > 0) {
            // Update the ref to the latest timestamp to avoid re-alerting
            const maxTimestamp = Math.max(...newCalls.map(c => c.timestamp));
            latestStaffCallTimeRef.current = maxTimestamp;

            // Only alert if the user is a staff member (not a customer table)
            if (currentUser && currentUser.role !== 'table') {
                
                // 1. Play Sound
                if (staffCallSoundUrl && isAudioUnlocked) {
                    const audio = new Audio(staffCallSoundUrl);
                    audio.play().catch(console.error);
                }

                // 2. Show Visual Popup
                // Get the most recent call details
                const latestCall = newCalls.sort((a, b) => b.timestamp - a.timestamp)[0];
                
                Swal.fire({
                    title: '🔔 มีลูกค้าเรียก!',
                    html: `
                        <div class="text-lg font-bold text-gray-800">โต๊ะ ${latestCall.tableName}</div>
                        <div class="text-sm text-gray-600">ลูกค้า: ${latestCall.customerName}</div>
                    `,
                    icon: 'info',
                    position: 'top', // Changed from 'top-center'
                    showConfirmButton: true,
                    confirmButtonText: 'รับทราบ',
                    timer: 10000, // 10 seconds
                    timerProgressBar: true,
                    backdrop: `rgba(0,0,0,0.4)` // Dim background slightly to grab attention
                });
            }
        }
    }, [staffCalls, staffCallSoundUrl, isAudioUnlocked, currentUser]);

    // NEW: Leave Request Notification Watcher (Popup)
    useEffect(() => {
        // Wait for initial load
        if (leaveRequests.length === 0) return;

        const currentMaxId = Math.max(0, ...leaveRequests.map(r => r.id));

        // Initial set to avoid alerting on existing data (first load)
        if (maxKnownLeaveIdRef.current === -1) {
            maxKnownLeaveIdRef.current = currentMaxId;
            return;
        }

        // Check for new items (ID greater than max known)
        if (currentMaxId > maxKnownLeaveIdRef.current) {
            // Find the specific new requests that are PENDING
            const newRequests = leaveRequests.filter(req => req.id > maxKnownLeaveIdRef.current && req.status === 'pending');

            // Define who sees the alert (same permissions as badge)
            const canApprove = currentUser?.role === 'admin' ||
                               currentUser?.role === 'branch-admin' ||
                               currentUser?.role === 'auditor';

            // Filter by branch permission if not Admin
            const visibleNewRequests = newRequests.filter(req => {
                if (currentUser?.role === 'admin') return true;
                return currentUser?.allowedBranchIds?.includes(req.branchId);
            });

            if (visibleNewRequests.length > 0 && canApprove) {
                // Play sound (Reuse notification sound if available)
                if (notificationSoundUrl && isAudioUnlocked) {
                    const audio = new Audio(notificationSoundUrl);
                    audio.play().catch(() => {});
                }

                // Show Popup
                const count = visibleNewRequests.length;
                const latest = visibleNewRequests[visibleNewRequests.length - 1]; // Get latest
                const typeLabel = latest.type === 'sick' ? 'ลาป่วย' : latest.type === 'personal' ? 'ลากิจ' : 'อื่นๆ';
                
                Swal.fire({
                    title: '📝 มีคำขอวันลาใหม่!',
                    html: `
                        <div class="text-left text-sm">
                            <p><strong>พนักงาน:</strong> ${latest.username}</p>
                            <p><strong>ประเภท:</strong> ${typeLabel}</p>
                            <p><strong>เหตุผล:</strong> ${latest.reason}</p>
                            ${count > 1 ? `<p class="mt-2 text-blue-600 font-bold">และอีก ${count - 1} รายการ...</p>` : ''}
                        </div>
                    `,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'ตรวจสอบทันที',
                    confirmButtonColor: '#3b82f6',
                    cancelButtonText: 'ไว้ทีหลัง',
                    backdrop: `rgba(0,0,0,0.4)`
                }).then((result) => {
                    if (result.isConfirmed) {
                        setCurrentView('leave');
                    }
                });
            }

            // Always update ref to avoid loops
            maxKnownLeaveIdRef.current = currentMaxId;
        }
    }, [leaveRequests, currentUser, notificationSoundUrl, isAudioUnlocked]);

    // NEW: Global Auto Print Effect (Replaces logic in KitchenView)
    useEffect(() => {
        if (prevOrdersForAutoPrint.current === null) {
            prevOrdersForAutoPrint.current = activeOrders;
            return;
        }
    
        if (!isAutoPrintEnabled || !currentUser || currentUser.role === 'table' || !printerConfig?.kitchen?.ipAddress || !branchId) {
            prevOrdersForAutoPrint.current = activeOrders;
            return;
        }
    
        const prevIds = new Set(prevOrdersForAutoPrint.current.map(o => o.id));
        const newOrders = activeOrders.filter(o => !prevIds.has(o.id));
    
        newOrders.forEach(async (order) => {
            // Only auto-print 'waiting' orders that haven't been printed yet (e.g. from customers)
            if (order.status === 'waiting' && !order.isPrintedToKitchen) {
                console.log(`[AutoPrint] Detected unprinted order #${order.orderNumber}. Attempting to print.`);
                
                // "Claim" the print job by updating Firestore. This prevents other devices from printing it.
                try {
                    const orderRef = db.collection(`branches/${branchId}/activeOrders`).doc(order.id.toString());
                    // We update first to minimize race conditions.
                    await orderRef.update({ isPrintedToKitchen: true });
    
                    // Now that we've claimed it, print it.
                    await printerService.printKitchenOrder(order, printerConfig.kitchen!);
                    console.log(`[AutoPrint] Success #${order.orderNumber}`);
                } catch (err) {
                     console.error(`[AutoPrint] Failed to claim or print order #${order.orderNumber}:`, err);
                     // If printing fails, we don't revert the flag to avoid print loops.
                     // A manual reprint might be necessary.
                }
            }
        });
    
        prevOrdersForAutoPrint.current = activeOrders;
    
    }, [activeOrders, isAutoPrintEnabled, currentUser, printerConfig, branchId]);

    // ... (Other effects for maintenance, stock alerts - omitted for brevity but preserved in logic) ...

    // Ref to track the previous view to detect navigation INTO stock page
    const prevViewForStockAlertRef = useRef<View | null>(null);

    // NEW: Effect to show out-of-stock popup when entering stock view
    useEffect(() => {
        const isEnteringStock = currentView === 'stock' && prevViewForStockAlertRef.current !== 'stock';
        
        if (isEnteringStock) {
            // Filter out-of-stock items (quantity <= 0)
            const outOfStockItems = stockItems.filter(item => {
                const qty = Number(item.quantity) || 0;
                return qty <= 0;
            });

            if (outOfStockItems.length > 0) {
                const listHtml = outOfStockItems.map(item => 
                    `<li style="text-align: left; margin-bottom: 4px;">
                        <span style="font-weight: bold; color: #374151;">${item.name}</span> 
                        <span style="color: #dc2626; font-size: 0.9em;">(คงเหลือ: ${item.quantity} ${item.unit})</span>
                    </li>`
                ).join('');

                Swal.fire({
                    title: '⚠️ แจ้งเตือนสินค้าหมด!',
                    html: `
                        <div style="font-size: 0.95rem; color: #4b5563;">
                            <p style="margin-bottom: 12px;">พบสินค้าหมดสต็อกจำนวน <strong style="color: #dc2626; font-size: 1.1rem;">${outOfStockItems.length}</strong> รายการ:</p>
                            <ul style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; padding: 12px 12px 12px 28px; max-height: 250px; overflow-y: auto;">
                                ${listHtml}
                            </ul>
                        </div>
                    `,
                    icon: 'warning',
                    confirmButtonText: 'รับทราบ',
                    confirmButtonColor: '#ef4444' // Red button
                });
            }
        }

        // Update ref for next render
        prevViewForStockAlertRef.current = currentView;
    }, [currentView, stockItems]);

    // --- USER PERSISTENCE ---
    useEffect(() => {
        if (currentUser) {
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            if (isFirebaseConfigured && firebase.messaging.isSupported()) {
                const messaging = firebase.messaging();
                messaging.getToken({ vapidKey: 'BDBGk_J108hNL-aQh-fFzAIpMwlD8TztXugeAnQj2hcmLAAjY0p8hWlGF3a0cSIwJhY_Jd3Tj3Y-2-fB8dJL_4' }).then((token) => { if (token) { setCurrentFcmToken(token); const userHasToken = prevUserRef.current?.fcmTokens?.includes(token); if (!userHasToken) { const updatedTokens = Array.from(new Set([...(currentUser.fcmTokens || []), token])); setUsers(prevUsers => prevUsers.map(u => u.id === currentUser.id ? { ...u, fcmTokens: updatedTokens } : u)); } } }).catch(() => {});
            }
        } 
        
        prevUserRef.current = currentUser;
    }, [currentUser, setUsers]);

    useEffect(() => { if (selectedBranch) localStorage.setItem('selectedBranch', JSON.stringify(selectedBranch)); else if (!isCustomerMode) localStorage.removeItem('selectedBranch'); }, [selectedBranch, isCustomerMode]);
    useEffect(() => { localStorage.setItem('currentView', currentView); }, [currentView]);
    useEffect(() => { if (floors.length > 0 && !selectedSidebarFloor) setSelectedSidebarFloor(floors[0]); }, [floors, selectedSidebarFloor]);
    useEffect(() => { if (window.AndroidBridge && typeof window.AndroidBridge.setPendingOrderCount === 'function') { window.AndroidBridge.setPendingOrderCount(totalKitchenBadgeCount); } }, [totalKitchenBadgeCount]);
    useEffect(() => { if (menuItems.length > 0 && !imageCacheTriggeredRef.current) { imageCacheTriggeredRef.current = true; const imageUrls = menuItems.map(item => item.imageUrl).filter(url => url && typeof url === 'string'); if ('serviceWorker' in navigator && navigator.serviceWorker.controller) { navigator.serviceWorker.controller.postMessage({ type: 'CACHE_IMAGES', urls: imageUrls }); } const handleMessage = (event: MessageEvent) => { if (event.data && event.data.type === 'CACHE_IMAGES_COMPLETE') { setIsCachingImages(false); navigator.serviceWorker.removeEventListener('message', handleMessage); } }; if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', handleMessage); } }, [menuItems]);


    // ============================================================================
    // 4. HANDLERS
    // ============================================================================
    
    const requestNotificationPermission = async () => {
        if ('Notification' in window && Notification.permission !== 'granted') {
            try { await Notification.requestPermission(); } catch (error) {}
        }
    };

    const handleAudioUnlock = useCallback(async () => {
        if (!isAudioUnlocked) {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            if (audioContext.state === 'suspended') audioContext.resume();
            new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=').play().then(() => setIsAudioUnlocked(true)).catch(() => setIsAudioUnlocked(true));
        }
        await requestNotificationPermission();
    }, [isAudioUnlocked]);
    
    const handleLogin = async (username: string, password: string) => {
        // 1. Try finding user in the Synced Firestore list
        let user = users.find(u => u.username === username && u.password === password);

        // 2. FALLBACK SAFETY NET: If user not found in synced list, check DEFAULT_USERS
        // This handles cases where DB is empty, wiped, or sync failed.
        // It guarantees 'admin'/'password' always works.
        if (!user) {
            const defaultUser = DEFAULT_USERS.find(u => u.username === username && u.password === password);
            if (defaultUser) {
                console.warn("Login via DEFAULT_USERS fallback. Firestore user list might be empty or missing.");
                user = defaultUser;
            }
        }

        if (user) {
            await requestNotificationPermission();
            
            // Fix: Immediately persist user to localStorage to avoid race conditions on refresh
            localStorage.setItem('currentUser', JSON.stringify(user));
            setCurrentUser(user);
            
            // Check for 'table' role to force Customer Mode
            if (user.role === 'table') {
                setIsCustomerMode(true);
                // Assign to specific table if set, otherwise potentially null (or handle Guest)
                // Note: CustomerView handles null tableId gracefully or shows loading/error
                if (user.assignedTableId) {
                    setCustomerTableId(user.assignedTableId);
                } else {
                    setCustomerTableId(null); 
                }

                // AUTO-SELECT BRANCH for 'table' user based on their allowedBranchIds
                if (user.allowedBranchIds && user.allowedBranchIds.length > 0) {
                    const branch = branches.find(b => b.id === user.allowedBranchIds![0]);
                    if (branch) {
                        setSelectedBranch(branch);
                        // Explicitly save selected branch for persistence
                        localStorage.setItem('selectedBranch', JSON.stringify(branch));
                    }
                }
            } else if (user.role === 'kitchen') {
                setCurrentView('kitchen');
            } else if (user.role === 'pos') {
                setCurrentView('pos');
            } else if (['admin', 'branch-admin', 'auditor'].includes(user.role)) {
                setCurrentView('dashboard');
            }
            return { success: true };
        }
        return { success: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
    };

    const handleLogout = () => { 
        setCurrentUser(null); 
        setSelectedBranch(null); 
        setIsCustomerMode(false); // Fix: Reset customer mode
        setCustomerTableId(null); // Fix: Clear assigned table
        localStorage.removeItem('currentUser'); 
        localStorage.removeItem('selectedBranch'); 
    };
    
    const handleMobileProfileClick = () => {
        Swal.fire({ title: 'ยืนยันการออกจากระบบ', text: "ท่านต้องการออกจากระบบใช่ไหม?", icon: 'question', showCancelButton: true, confirmButtonText: 'ใช่', cancelButtonText: 'ยกเลิก' }).then((result) => { if (result.isConfirmed) handleLogout(); });
    };
    
    const handleSelectBranch = (branch: Branch) => { setSelectedBranch(branch); };
    const handleUpdateCurrentUser = (updates: Partial<User>) => {
        setUsers(prevUsers => prevUsers.map(user => user.id === currentUser?.id ? { ...user, ...updates } : user));
        setCurrentUser(prev => (prev ? { ...prev, ...updates } : null));
    };

    const handleModalClose = () => {
        setModalState({
            isMenuItem: false, isOrderSuccess: false, isSplitBill: false, isTableBill: false,
            isPayment: false, isPaymentSuccess: false, isSettings: false, isEditCompleted: false,
            isUserManager: false, isBranchManager: false, isMoveTable: false, isCancelOrder: false,
            isCashBill: false, isSplitCompleted: false, isCustomization: false, isLeaveRequest: false,
            isMenuSearch: false, isMergeBill: false
        });
        setItemToEdit(null); setOrderForModal(null); setItemToCustomize(null); setOrderItemToEdit(null);
    };
    
    const handleClearOrder = () => { setCurrentOrderItems([]); setCustomerName(''); setCustomerCount(1); setSelectedTableId(null); };
    const handleAddItemToOrder = (item: MenuItem) => { setItemToCustomize(item); setModalState(prev => ({ ...prev, isCustomization: true, isMenuSearch: false })); };
    const handleConfirmCustomization = (itemToAdd: OrderItem) => { setCurrentOrderItems(prevItems => { const existingItemIndex = prevItems.findIndex(i => i.cartItemId === (orderItemToEdit?.cartItemId || itemToAdd.cartItemId)); if (orderItemToEdit) { const newItems = [...prevItems]; newItems[existingItemIndex] = { ...itemToAdd, quantity: orderItemToEdit.quantity }; return newItems; } else { if (existingItemIndex !== -1) { const newItems = [...prevItems]; newItems[existingItemIndex].quantity += itemToAdd.quantity; return newItems; } else { return [...prevItems, itemToAdd]; } } }); handleModalClose(); };
    const handleUpdateOrderItem = (itemToUpdate: OrderItem) => { setItemToCustomize(itemToUpdate); setOrderItemToEdit(itemToUpdate); setModalState(prev => ({ ...prev, isCustomization: true })); };
    const handleQuantityChange = (cartItemId: string, newQuantity: number) => { setCurrentOrderItems(prevItems => { if (newQuantity <= 0) return prevItems.filter(i => i.cartItemId !== cartItemId); return prevItems.map(i => i.cartItemId === cartItemId ? { ...i, quantity: newQuantity } : i); }); };
    const handleRemoveItem = (cartItemId: string) => { setCurrentOrderItems(prevItems => prevItems.filter(i => i.cartItemId !== cartItemId)); };
    
    const handlePlaceOrder = async (orderItems: OrderItem[] = currentOrderItems, custName: string = customerName, custCount: number = customerCount, tableOverride: Table | null = selectedTable, isLineMan: boolean = false, lineManNumber?: string, deliveryProviderName?: string): Promise<number | undefined> => { 
        if (!isLineMan && !tableOverride) { 
            Swal.fire('กรุณาเลือกโต๊ะ', 'ต้องเลือกโต๊ะสำหรับออเดอร์ หรือเลือก Delivery', 'warning'); 
            return; 
        } 

        let finalTable = tableOverride;
        if (!isLineMan && finalTable && finalTable.name === 'กำลังโหลด...') {
            const realTable = tables.find(t => t.id === finalTable!.id);
            if (realTable) {
                finalTable = realTable;
            } else {
                Swal.fire({ icon: 'error', title: 'ไม่พบข้อมูลโต๊ะ', text: 'กรุณาลองใหม่อีกครั้ง หรือติดต่อพนักงาน (รหัสโต๊ะอาจไม่ถูกต้อง)', });
                return;
            }
        }

        if (orderItems.length === 0) return; 
        if (!isOnline) { Swal.fire('เชื่อมต่ออินเทอร์เน็ตไม่ได้', 'ไม่สามารถสั่งอาหารได้ในขณะนี้', 'error'); return; } 
        setIsPlacingOrder(true); 

        try { 
            const MAX_RETRIES = 3; // 1 initial attempt + 2 retries
            let result;

            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                try {
                    const branchIdStr = branchId;
                    if (!branchIdStr) {
                        throw new Error('ไม่พบข้อมูลสาขา (Branch ID Missing)');
                    }
                    
                    const counterRef = db.doc(`branches/${branchIdStr}/orderCounter/data`);
                    result = await db.runTransaction(async (transaction: firebase.firestore.Transaction) => { 
                        const counterDoc = await transaction.get(counterRef); 
                        const counterData = (counterDoc.data() as { value: OrderCounter | undefined })?.value; 
                        const today = new Date(); 
                        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`; 
                        let nextOrderId = 1; 
                        if (counterData && typeof counterData.count === 'number' && typeof counterData.lastResetDate === 'string' && counterData.lastResetDate === todayStr) { 
                            nextOrderId = counterData.count + 1; 
                        } 
                        const itemsWithOrigin = orderItems.map(item => ({ ...item, originalOrderNumber: nextOrderId, })); 
                        const orderTableName = isLineMan ? (deliveryProviderName || 'Delivery') : (finalTable ? finalTable.name : 'Unknown'); 
                        const orderFloor = isLineMan ? 'Delivery' : (finalTable ? finalTable.floor : 'Unknown'); 
                        const orderTableId = isLineMan ? -99 : (finalTable ? finalTable.id : 0); 
                        const shouldSendToKitchen = isCustomerMode || sendToKitchen || isLineMan;
                        const isPrintedImmediatelyByThisDevice = !isCustomerMode && shouldSendToKitchen;
                        
                        const newOrder: ActiveOrder = {
                            id: Date.now(),
                            orderNumber: nextOrderId,
                            tableId: orderTableId,
                            tableName: orderTableName,
                            floor: orderFloor,
                            customerCount: custCount,
                            items: itemsWithOrigin,
                            status: shouldSendToKitchen ? 'waiting' : 'served',
                            orderTime: Date.now(),
                            orderType: isLineMan ? 'lineman' : 'dine-in',
                            taxRate: isTaxEnabled ? taxRate : 0,
                            taxAmount: 0, // This is calculated right after
                            placedBy: currentUser ? currentUser.username : (custName || `โต๊ะ ${orderTableName}`),
                            
                            // --- SAFETY FIX for UNDEFINED values ---
                            // Explicitly define all optional fields to prevent silent Firestore write failures.
                            customerName: custName || '',
                            manualOrderNumber: lineManNumber || null,
                            isPrintedToKitchen: isPrintedImmediatelyByThisDevice,
                            cookingStartTime: null,
                            isOverdue: false,
                            parentOrderId: null,
                            takeawayCutlery: [],
                            takeawayCutleryNotes: '',
                            isDeleted: false,
                            deletedBy: null,
                            mergedOrderNumbers: [],
                            splitCount: 0,
                            isSplitChild: false,
                            splitIndex: 0,
                        };
                        
                        const subtotal = newOrder.items.reduce((sum, item) => sum + item.finalPrice * item.quantity, 0); 
                        newOrder.taxAmount = newOrder.taxRate > 0 ? subtotal * (newOrder.taxRate / 100) : 0; 
                        transaction.set(counterRef, { value: { count: nextOrderId, lastResetDate: todayStr } }); 
                        const newOrderDocRef = db.collection(`branches/${branchIdStr}/activeOrders`).doc(newOrder.id.toString()); 
                        transaction.set(newOrderDocRef, { ...newOrder, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() }); 
                        return { newOrder, shouldSendToKitchen, isPrintedImmediatelyByThisDevice }; 
                    });

                    // If transaction is successful, break the loop
                    break;
                } catch (error: any) {
                    // Firebase v8 uses `code`, e.g., 'aborted' for contention.
                    if (error.code === 'aborted' && attempt < MAX_RETRIES) {
                        console.warn(`Place order contention detected. Retrying attempt ${attempt + 1}...`);
                        await new Promise(res => setTimeout(res, 100 * attempt)); // Small delay with backoff
                    } else {
                        // If it's another error or max retries reached, re-throw to be caught by the outer catch
                        throw error;
                    }
                }
            }

            if (!result) {
                 // This should only be reached if retries fail silently, which is unlikely.
                 throw new Error('Transaction failed after multiple retries without a specific error.');
            }

            const { newOrder, isPrintedImmediatelyByThisDevice } = result;
            setLastPlacedOrderId(newOrder.orderNumber); 
            setModalState(prev => ({ ...prev, isOrderSuccess: true })); 
        
            if (isPrintedImmediatelyByThisDevice && printerConfig?.kitchen?.ipAddress) {
                try {
                    await printerService.printKitchenOrder(newOrder, printerConfig.kitchen);
                } catch (printError: any) {
                    console.error("Kitchen print failed (Direct):", printError);
                    Swal.fire('พิมพ์ไม่สำเร็จ', 'ไม่สามารถเชื่อมต่อเครื่องพิมพ์ครัวได้', 'error');
                }
            }
            
            return newOrder.orderNumber;

        } catch (error: any) {
            console.error("Failed to place order:", error);
            const errorMessage = (error.message || '').toLowerCase();
            
            // Handle race condition failure after all retries
            if (error.code === 'aborted') {
                Swal.fire('ระบบกำลังยุ่ง', 'การส่งออเดอร์พร้อมกันหลายเครื่อง กรุณาลองอีกครั้งในอีกสักครู่', 'warning');
            }
            // IMPROVED ERROR HANDLING FOR QUOTA
            else if (errorMessage.includes('quota') || errorMessage.includes('resource_exhausted')) {
                Swal.fire({
                    icon: 'error',
                    title: 'โควต้าการใช้งานเต็ม',
                    html: `
                        <div class="text-left text-gray-700">
                            <p class="font-bold">โควต้าการบันทึกข้อมูลสำหรับวันนี้เต็มแล้ว</p>
                            <p class="mt-2 text-sm">ออเดอร์นี้จึงไม่ถูกบันทึกเข้าระบบ</p>
                            <hr class="my-3"/>
                            <p class="text-sm"><strong>สาเหตุ:</strong> แอปพลิเคชันนี้ใช้แผนบริการฟรีของ Firebase ซึ่งมีจำกัดการใช้งานรายวัน</p>
                            <p class="text-sm mt-2"><strong>วิธีแก้ไข:</strong></p>
                            <ul class="list-disc list-inside text-sm pl-4 mt-1">
                                <li><strong>ชั่วคราว:</strong> ระบบจะกลับมาใช้งานได้อีกครั้งในวันพรุ่งนี้ (โควต้าจะรีเซ็ตทุกวัน)</li>
                                <li><strong>ถาวร:</strong> อัปเกรดแผน Firebase เป็น <strong class="text-orange-500">Blaze (Pay-as-you-go)</strong> เพื่อใช้งานได้ไม่จำกัด</li>
                            </ul>
                        </div>
                    `,
                    confirmButtonText: 'รับทราบ',
                });
            } else {
                Swal.fire('เกิดข้อผิดพลาด', error.message || 'ไม่สามารถสร้างออเดอร์ได้', 'error');
            }
        } finally { 
            setIsPlacingOrder(false); 
            if (!isCustomerMode) { 
                setCurrentOrderItems([]); 
                setCustomerName(''); 
                setCustomerCount(1); 
                setSelectedTableId(null); 
            } 
        } 
    };

    const handleStartCooking = (orderId: number) => { if (!isOnline) return; activeOrdersActions.update(orderId, { status: 'cooking', cookingStartTime: Date.now() }); };
    
    // UPDATED: handleCompleteOrder to show provider name for delivery orders
    const handleCompleteOrder = async (orderId: number) => { 
        if (!isOnline) return; 
        const order = activeOrders.find(o => o.id === orderId); 
        if (!order) return; 
        
        if (order.orderType === 'lineman') { 
            try { 
                const paymentDetails: PaymentDetails = { method: 'transfer' }; 
                const completed: CompletedOrder = { ...order, status: 'completed', completionTime: Date.now(), paymentDetails: paymentDetails, completedBy: currentUser?.username || 'Auto-Kitchen' }; 
                await activeOrdersActions.update(orderId, { status: 'completed', completionTime: completed.completionTime, paymentDetails: paymentDetails }); 
                await db.collection(`branches/${branchId}/completedOrders_v2`).doc(orderId.toString()).set(completed); 
                
                // Show provider name from tableName
                Swal.fire({ 
                    icon: 'success', 
                    title: `${order.tableName} Completed`, 
                    text: `ออเดอร์ #${order.orderNumber} จบงานและบันทึกยอดขายแล้ว`, 
                    timer: 1500, 
                    showConfirmButton: false 
                }); 
            } catch (error) { 
                console.error("Auto-complete failed", error); 
                Swal.fire('Error', 'Failed to auto-complete LineMan order', 'error'); 
            } 
        } else { 
            activeOrdersActions.update(orderId, { status: 'served' }); 
        } 
    };

    const handlePrintKitchenOrder = async (orderId: number) => { const order = activeOrders.find(o => o.id === orderId); if (!order) return; if (!printerConfig?.kitchen) { Swal.fire('ไม่พบเครื่องพิมพ์', 'กรุณาตั้งค่าเครื่องพิมพ์ครัวก่อน', 'warning'); return; } try { Swal.fire({ title: 'กำลังส่งพิมพ์...', text: 'กรุณารอสักครู่', timer: 1000, showConfirmButton: false, didOpen: () => { Swal.showLoading(); } }); await printerService.printKitchenOrder(order, printerConfig.kitchen); } catch (error: any) { console.error("Reprint failed:", error); Swal.fire('พิมพ์ไม่สำเร็จ', error.message || 'ไม่สามารถเชื่อมต่อเครื่องพิมพ์ได้', 'error'); } };
    const handleShowBill = (orderId: number) => { const order = activeOrders.find(o => o.id === orderId); if (order) { setOrderForModal(order); setModalState(prev => ({ ...prev, isTableBill: true })); } };
    const handleConfirmPayment = async (orderId: number, paymentDetails: PaymentDetails) => { if (!isOnline) { Swal.fire('Offline', 'ไม่สามารถชำระเงินได้ขณะ Offline', 'warning'); return; } setIsConfirmingPayment(true); const orderToComplete = activeOrders.find(o => o.id === orderId); if (!orderToComplete) { setIsConfirmingPayment(false); return; } try { const completed: CompletedOrder = { ...orderToComplete, status: 'completed', completionTime: Date.now(), paymentDetails: paymentDetails, completedBy: currentUser?.username || 'Unknown' }; await activeOrdersActions.update(orderId, { status: 'completed', completionTime: completed.completionTime, paymentDetails: paymentDetails }); await db.collection(`branches/${branchId}/completedOrders_v2`).doc(orderId.toString()).set(completed); } catch (error) { console.error("Payment failed", error); Swal.fire('Error', 'Payment processing failed', 'error'); } finally { setIsConfirmingPayment(false); setModalState(prev => ({ ...prev, isPayment: false, isPaymentSuccess: true })); setOrderForModal(orderToComplete); } };
    const handlePaymentSuccessClose = async (shouldPrint: boolean) => { const order = orderForModal as CompletedOrder; handleModalClose(); if (shouldPrint && order && printerConfig?.cashier) { try { await printerService.printReceipt(order, printerConfig.cashier, restaurantName, logoUrl, qrCodeUrl); } catch (printError: any) { console.error("Receipt print failed:", printError); Swal.fire('พิมพ์ไม่สำเร็จ', 'ไม่สามารถเชื่อมต่อเครื่องพิมพ์ใบเสร็จได้', 'error'); } } };
    const handleReprintReceipt = async (order: CompletedOrder) => { if (!printerConfig?.cashier) { Swal.fire({ icon: 'warning', title: 'ไม่พบการตั้งค่าเครื่องพิมพ์', text: 'กรุณาตั้งค่าเครื่องพิมพ์ใบเสร็จก่อนใช้งาน', confirmButtonText: 'ไปที่ตั้งค่า' }).then((result) => { if (result.isConfirmed) { setModalState(prev => ({ ...prev, isSettings: true })); } }); return; } try { Swal.fire({ title: 'กำลังส่งคำสั่งพิมพ์...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } }); await printerService.printReceipt(order, printerConfig.cashier, restaurantName, logoUrl, qrCodeUrl); Swal.close(); Swal.fire({ icon: 'success', title: 'ส่งคำสั่งพิมพ์แล้ว', timer: 1500, showConfirmButton: false }); } catch (error: any) { console.error("Reprint failed:", error); Swal.close(); Swal.fire('พิมพ์ไม่สำเร็จ', error.message || 'ไม่สามารถเชื่อมต่อเครื่องพิมพ์ได้', 'error'); } };
    const handleSaveMenuItem = (itemData: Omit<MenuItem, 'id'> & { id?: number }) => { setMenuItems(prev => { if (itemData.id) return prev.map(item => item.id === itemData.id ? { ...item, ...itemData } as MenuItem : item); const newId = Math.max(0, ...prev.map(i => i.id)) + 1; return [...prev, { ...itemData, id: newId }]; }); handleModalClose(); };
    const handleDeleteMenuItem = (id: number) => { Swal.fire({ title: 'ยืนยันการลบ?', text: "คุณต้องการลบเมนูนี้ใช่หรือไม่?", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ใช่, ลบเลย!' }).then((result) => { if (result.isConfirmed) setMenuItems(prev => prev.filter(item => item.id !== id)); }); };
    const handleAddCategory = (name: string) => { if (!categories.includes(name)) setCategories(prev => [...prev, name]); };
    const handleUpdateCategory = (oldName: string, newName: string) => { setCategories(prev => Array.from(new Set(prev.map(c => c === oldName ? newName : c)))); setMenuItems(prev => prev.map(item => item.category === oldName ? { ...item, category: newName } : item)); };
    const handleDeleteCategory = (name: string) => { setCategories(prev => prev.filter(c => c !== name)); };
    const handleAddTable = (floor: string) => { const newId = Math.max(0, ...tables.map(t => t.id)) + 1; const tablesOnFloor = tables.filter(t => t.floor === floor); const newTableName = `T${tablesOnFloor.length + 1}`; setTables(prev => [...prev, { id: newId, name: newTableName, floor: floor, activePin: null, reservation: null }]); };
    const handleRemoveLastTable = (floor: string) => { const tablesOnFloor = tables.filter(t => t.floor === floor).sort((a,b) => a.id - b.id); if (tablesOnFloor.length > 0) { const lastTable = tablesOnFloor[tablesOnFloor.length - 1]; if (activeOrders.some(o => o.tableId === lastTable.id)) { Swal.fire('ไม่สามารถลบได้', `โต๊ะ ${lastTable.name} กำลังมีออเดอร์อยู่`, 'error'); return; } setTables(prev => prev.filter(t => t.id !== lastTable.id)); } };
    const handleAddFloor = () => { Swal.fire({ title: 'เพิ่มชั้นใหม่', input: 'text', showCancelButton: true, confirmButtonText: 'เพิ่ม' }).then((result) => { if (result.isConfirmed && result.value && !floors.includes(result.value)) setFloors(prev => [...prev, result.value]); }); };
    const handleRemoveFloor = (floor: string) => { if (tables.some(t => t.floor === floor)) { Swal.fire('ไม่สามารถลบได้', `ชั้น "${floor}" ยังมีโต๊ะอยู่`, 'error'); return; } Swal.fire({ title: `ลบชั้น "${floor}"?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'ลบเลย' }).then((result) => { if (result.isConfirmed) { setFloors(prev => prev.filter(f => f !== floor)); if (selectedSidebarFloor === floor) setSelectedSidebarFloor(floors[0] || ''); } }); };
    const handleDeleteHistory = async (completedIds: number[], cancelledIds: number[], printIds: number[]) => { if (!currentUser) return; const username = currentUser.username; const isAdmin = currentUser.role === 'admin'; if (completedIds.length > 0) { const newIds = completedIds.filter(id => newCompletedOrders.some(o => o.id === id)); const legacyIds = completedIds.filter(id => !newIds.includes(id)); for (const id of newIds) { if (isAdmin) { await newCompletedOrdersActions.remove(id); } else { await newCompletedOrdersActions.update(id, { isDeleted: true, deletedBy: username }); } } if (legacyIds.length > 0) { setLegacyCompletedOrders(prev => { if (isAdmin) return prev.filter(o => !legacyIds.includes(o.id)); return prev.map(o => legacyIds.includes(o.id) ? { ...o, isDeleted: true, deletedBy: username } : o); }); } } if (cancelledIds.length > 0) { const newIds = cancelledIds.filter(id => newCancelledOrders.some(o => o.id === id)); const legacyIds = cancelledIds.filter(id => !newIds.includes(id)); for (const id of newIds) { if (isAdmin) { await newCancelledOrdersActions.remove(id); } else { await newCancelledOrdersActions.update(id, { isDeleted: true, deletedBy: username }); } } if (legacyIds.length > 0) { setLegacyCancelledOrders(prev => { if (isAdmin) return prev.filter(o => !legacyIds.includes(o.id)); return prev.map(o => legacyIds.includes(o.id) ? { ...o, isDeleted: true, deletedBy: username } : o); }); } } if (printIds.length > 0) { setPrintHistory(prev => { if (isAdmin) return prev.filter(p => !printIds.includes(p.id)); return prev.map(p => printIds.includes(p.id) ? { ...p, isDeleted: true, deletedBy: username } : p); }); } };
    const handleGeneratePin = (tableId: number) => { const pin = String(Math.floor(100 + Math.random() * 900)); setTables(prev => prev.map(t => t.id === tableId ? { ...t, activePin: pin } : t)); };
    const handleConfirmSplit = async (itemsToSplit: OrderItem[]) => { if (!orderForModal || !isOnline) return; const originalOrder = orderForModal as ActiveOrder; const newSplitCount = (originalOrder.splitCount || 0) + 1; const splitOrderId = Date.now(); try { const updatedOriginalItems: OrderItem[] = []; const itemsToRemoveMap = new Map<string, number>(); itemsToSplit.forEach(item => { itemsToRemoveMap.set(item.cartItemId, (itemsToRemoveMap.get(item.cartItemId) || 0) + item.quantity); }); originalOrder.items.forEach(origItem => { const qtyToRemove = itemsToRemoveMap.get(origItem.cartItemId); if (qtyToRemove && qtyToRemove > 0) { const remainingQty = origItem.quantity - qtyToRemove; if (remainingQty > 0) { updatedOriginalItems.push({ ...origItem, quantity: remainingQty }); itemsToRemoveMap.set(origItem.cartItemId, 0); } else { itemsToRemoveMap.set(origItem.cartItemId, 0); } } else { updatedOriginalItems.push(origItem); } }); const newSplitOrder: ActiveOrder = { ...originalOrder, id: splitOrderId, items: itemsToSplit, parentOrderId: originalOrder.orderNumber, isSplitChild: true, splitIndex: newSplitCount, mergedOrderNumbers: [], status: originalOrder.status }; const batch = db.batch(); const originalRef = db.collection(`branches/${branchId}/activeOrders`).doc(originalOrder.id.toString()); const newRef = db.collection(`branches/${branchId}/activeOrders`).doc(splitOrderId.toString()); batch.update(originalRef, { items: updatedOriginalItems, splitCount: newSplitCount, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() }); batch.set(newRef, { ...newSplitOrder, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() }); await batch.commit(); handleModalClose(); } catch (error) { console.error("Split failed", error); Swal.fire('Error', 'Failed to split bill', 'error'); } };
    const handleConfirmMoveTable = async (orderId: number, newTableId: number) => { if (!isOnline) return; const newTable = tables.find(t => t.id === newTableId); if (!newTable) return; await activeOrdersActions.update(orderId, { tableId: newTable.id, tableName: newTable.name, floor: newTable.floor }); Swal.fire({ icon: 'success', title: 'ย้ายโต๊ะสำเร็จ', timer: 1500, showConfirmButton: false }); handleModalClose(); };
    const handleConfirmCancelOrder = async (orderToCancel: ActiveOrder, reason: CancellationReason, notes?: string) => { if (!isOnline) return; const cancelledOrder: CancelledOrder = { ...orderToCancel, status: 'cancelled', cancellationTime: Date.now(), cancelledBy: currentUser!.username, cancellationReason: reason, cancellationNotes: notes, }; await activeOrdersActions.update(orderToCancel.id, { status: 'cancelled', cancellationReason: reason, cancellationNotes: notes }); await db.collection(`branches/${branchId}/cancelledOrders_v2`).doc(cancelledOrder.id.toString()).set(cancelledOrder); handleModalClose(); };
    const handleConfirmMerge = async (sourceOrderIds: number[], targetOrderId: number) => { if (!isOnline) return; const sourceOrders = activeOrders.filter(o => sourceOrderIds.includes(o.id)); const targetOrder = activeOrders.find(o => o.id === targetOrderId); if (!targetOrder || sourceOrders.length === 0) return; const allItemsToMerge = sourceOrders.flatMap(o => o.items.map(item => ({ ...item, originalOrderNumber: item.originalOrderNumber ?? o.orderNumber, cartItemId: `${item.cartItemId}_m_${o.orderNumber}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` }))); const sourceNumbers = sourceOrders.map(o => o.orderNumber); const newItems = [...targetOrder.items, ...allItemsToMerge]; const newMergedNumbers = Array.from(new Set([...(targetOrder.mergedOrderNumbers || []), ...sourceNumbers])).sort((a, b) => a - b); const batch = db.batch(); const targetRef = db.collection(`branches/${branchId}/activeOrders`).doc(targetOrderId.toString()); batch.update(targetRef, { items: newItems, mergedOrderNumbers: newMergedNumbers, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() }); for (const sourceId of sourceOrderIds) { const sourceRef = db.collection(`branches/${branchId}/activeOrders`).doc(sourceId.toString()); batch.update(sourceRef, { status: 'cancelled', cancellationReason: 'อื่นๆ', cancellationNotes: `Merged into Order #${targetOrder.orderNumber}`, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() }); } try { await batch.commit(); handleModalClose(); } catch (error) { console.error("Merge failed", error); Swal.fire('Error', 'Failed to merge bills. Please try again.', 'error'); } };
    const handleMergeAndPay = async (sourceOrderIds: number[], targetOrderId: number) => { if (!isOnline) return; const sourceOrders = activeOrders.filter(o => sourceOrderIds.includes(o.id)); const targetOrder = activeOrders.find(o => o.id === targetOrderId); if (!targetOrder || sourceOrders.length === 0) return; const allItemsToMerge = sourceOrders.flatMap(o => o.items.map(item => ({ ...item, originalOrderNumber: item.originalOrderNumber ?? o.orderNumber, cartItemId: `${item.cartItemId}_m_${o.orderNumber}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` }))); const sourceNumbers = sourceOrders.map(o => o.orderNumber); const newItems = [...targetOrder.items, ...allItemsToMerge]; const newMergedNumbers = Array.from(new Set([...(targetOrder.mergedOrderNumbers || []), ...sourceNumbers])).sort((a, b) => a - b); const batch = db.batch(); const targetRef = db.collection(`branches/${branchId}/activeOrders`).doc(targetOrderId.toString()); batch.update(targetRef, { items: newItems, mergedOrderNumbers: newMergedNumbers, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() }); for (const sourceId of sourceOrderIds) { const sourceRef = db.collection(`branches/${branchId}/activeOrders`).doc(sourceId.toString()); batch.update(sourceRef, { status: 'cancelled', cancellationReason: 'อื่นๆ', cancellationNotes: `Merged into Order #${targetOrder.orderNumber}`, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() }); } try { await batch.commit(); const updatedTargetOrder: ActiveOrder = { ...targetOrder, items: newItems, mergedOrderNumbers: newMergedNumbers }; setOrderForModal(updatedTargetOrder); setModalState(prev => ({ ...prev, isPayment: true, isTableBill: false })); } catch (error) { console.error("Merge and Pay failed", error); Swal.fire('Error', 'Failed to merge bills. Please try again.', 'error'); } };
    const handleToggleAvailability = (id: number) => { setMenuItems(prev => prev.map(i => i.id === id ? { ...i, isAvailable: i.isAvailable === false ? true : false } : i)); };
    const handleToggleVisibility = (id: number) => { setMenuItems(prev => prev.map(i => i.id === id ? { ...i, isVisible: i.isVisible === false ? true : false } : i)); };
    const handleUpdateOrderFromModal = async (orderId: number, items: OrderItem[], customerCount: number) => { if (!isOnline) return; if (items.length === 0) { const orderToCancel = activeOrders.find(o => o.id === orderId); if (orderToCancel) { await handleConfirmCancelOrder(orderToCancel, 'อื่นๆ', 'ยกเลิกอัตโนมัติ (รายการอาหารถูกลบหมด)'); Swal.fire({ icon: 'info', title: 'ยกเลิกบิลอัตโนมัติ', text: 'บิลถูกยกเลิกเนื่องจากไม่มีรายการอาหารเหลืออยู่', timer: 2000, showConfirmButton: false }); } else { handleModalClose(); } } else { await activeOrdersActions.update(orderId, { items, customerCount }); handleModalClose(); } };
    
    // RENDER LOGIC
    
    // 0. Render Queue Display Mode
    if (isQueueMode) {
        if (!branchId) {
            return (
                <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-900 text-white">
                    <h1 className="text-2xl font-bold">กรุณาระบุสาขา</h1>
                    <p className="text-gray-400 mt-2">โปรดเพิ่ม `?branchId=...` ใน URL ของคุณ</p>
                </div>
            );
        }
        if (!selectedBranch) return <PageLoading />;

        return (
            <Suspense fallback={<PageLoading />}>
                <QueueDisplay
                    activeOrders={activeOrders}
                    restaurantName={restaurantName}
                    logoUrl={appLogoUrl || logoUrl}
                />
            </Suspense>
        );
    }

    // 1. Force Customer View for Table Role OR explicit Customer Mode
    if (isCustomerMode || currentUser?.role === 'table') {
        let targetTableId = customerTableId;
        if (currentUser?.role === 'table' && currentUser.assignedTableId) {
            targetTableId = currentUser.assignedTableId;
        }

        // --- IMPROVEMENT: NON-BLOCKING CUSTOMER MODE ---
        
        let customerTable = tables.find(t => t.id === targetTableId);

        // OPTIMISTIC LOADING: If table not found in list yet, create a dummy immediately
        // This ensures the menu opens instantly (< 3s) while data loads in background.
        if (!customerTable && targetTableId) {
            customerTable = {
                id: targetTableId,
                name: 'กำลังโหลด...',
                floor: '-',
                activePin: null,
                reservation: null
            };
        }

        // If the table is found OR we made a temp one, render the main customer view.
        if (customerTable) {
             const visibleMenuItems = menuItems.filter(item => item.isVisible !== false);
             return (
                <Suspense fallback={<PageLoading />}>
                    <CustomerView 
                        table={customerTable}
                        menuItems={visibleMenuItems}
                        categories={categories}
                        activeOrders={activeOrders.filter(o => o.tableId === targetTableId)}
                        allBranchOrders={activeOrders}
                        completedOrders={completedOrders}
                        onPlaceOrder={(items, name) => handlePlaceOrder(items, name, 1, customerTable)}
                        onStaffCall={(table, custName) => setStaffCalls(prev => [...prev, {id: Date.now(), tableId: table.id, tableName: `${table.name} (${table.floor})`, customerName: custName, branchId: selectedBranch ? selectedBranch.id : Number(branchId || 0), timestamp: Date.now()}])}
                        recommendedMenuItemIds={recommendedMenuItemIds}
                        logoUrl={appLogoUrl || logoUrl}
                        restaurantName={restaurantName}
                        onLogout={handleLogout}
                    />
                </Suspense>
             );
        }

        // If after loading tables, the specific table ID is still not found AND we aren't loading anymore, show the error screen.
        // This is now a confirmed error, not a race condition.
        return (
            <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gray-100 p-4 text-center">
                <div className="bg-white p-8 rounded-2xl shadow-lg max-w-sm w-full">
                    <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-red-100 mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">เกิดข้อผิดพลาด</h2>
                    <p className="text-gray-600 mb-4">
                        ไม่พบข้อมูลโต๊ะที่ท่านสแกน QR Code อาจไม่อัปเดตหรือไม่ถูกต้อง
                    </p>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p className="font-semibold text-yellow-800">กรุณาแจ้งพนักงานเพื่อดำเนินการ</p>
                        <p className="mt-2 text-xs text-yellow-700">
                            (สำหรับพนักงาน: Table ID <code className="font-mono bg-yellow-200 px-1 rounded">{targetTableId || 'Not Set'}</code> ไม่ถูกต้อง)
                        </p>
                    </div>
                </div>
                <p className="text-xs text-gray-400 mt-6">
                    POS System by SEOUL GOOD
                </p>
            </div>
        );
    }

    if (!currentUser) return <LoginScreen onLogin={handleLogin} logoUrl={appLogoUrl} restaurantName={restaurantName} />;

    if (!selectedBranch && currentUser.role !== 'admin') {
         return <BranchSelectionScreen currentUser={currentUser} branches={branches} onSelectBranch={handleSelectBranch} onManageBranches={() => setModalState(prev => ({...prev, isBranchManager: true}))} onLogout={handleLogout} />;
    }
    
    if (!selectedBranch && currentUser.role === 'admin') {
         return <BranchSelectionScreen currentUser={currentUser} branches={branches} onSelectBranch={handleSelectBranch} onManageBranches={() => setModalState(prev => ({...prev, isBranchManager: true}))} onLogout={handleLogout} />;
    }

    if (!selectedBranch) return <div>Error: No branch selected. Please log out and try again.</div>

    // ... (Keep MobileHeader component) ...
    const MobileHeader = ({ user, restaurantName, onOpenSearch, onProfileClick, isOrderNotificationsEnabled, onToggleOrderNotifications, onOpenSettings }: { user: User, restaurantName: string, onOpenSearch: () => void, onProfileClick: () => void, isOrderNotificationsEnabled: boolean, onToggleOrderNotifications: () => void, onOpenSettings: () => void }) => (
        <header className="bg-gray-900 text-white p-3 flex justify-between items-center flex-shrink-0 md:hidden z-30 shadow-lg relative">
            <div className="flex items-center gap-3 cursor-pointer" onClick={onProfileClick}>
                <img src={user.profilePictureUrl || "https://img.icons8.com/fluency/48/user-male-circle.png"} alt={user.username} className="h-10 w-10 rounded-full object-cover border-2 border-gray-700"/>
                <div>
                    <p className="font-semibold text-white leading-none">{user.username}</p>
                    <span className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded font-mono">{user.role}</span>
                </div>
            </div>
            <h1 className="text-xl font-bold text-red-500 absolute left-1/2 -translate-x-1/2 whitespace-nowrap hidden sm:block">{restaurantName}</h1>
            <div className="flex items-center gap-3">
                <button onClick={onOpenSettings} className="p-2 text-gray-300 rounded-full hover:bg-gray-700" aria-label="Settings">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </button>
                <label className="relative inline-flex items-center cursor-pointer" title="เปิด/ปิด เสียงแจ้งเตือน">
                    <input type="checkbox" checked={isOrderNotificationsEnabled} onChange={onToggleOrderNotifications} className="sr-only peer" />
                    <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                </label>
                <button onClick={onOpenSearch} className="p-2 text-gray-300 rounded-full hover:bg-gray-700" aria-label="Search Menu">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </button>
            </div>
        </header>
    );

    // Main App Layout
    return (
        <div className={`h-screen w-screen flex flex-col md:flex-row bg-gray-100 overflow-hidden ${isDesktop ? 'landscape-mode' : ''}`} onClick={handleAudioUnlock}>
            {/* Desktop Admin Sidebar */}
            {isAdminViewOnDesktop && (
                <Suspense fallback={<div className="w-64 bg-gray-800 h-full animate-pulse"></div>}>
                    <AdminSidebar 
                        isCollapsed={isAdminSidebarCollapsed} onToggleCollapse={() => setIsAdminSidebarCollapsed(!isAdminSidebarCollapsed)}
                        logoUrl={appLogoUrl || logoUrl} // Prioritize App Logo (Red)
                        restaurantName={restaurantName} branchName={selectedBranch.name} currentUser={currentUser}
                        onViewChange={setCurrentView} currentView={currentView} onToggleEditMode={() => setIsEditMode(!isEditMode)} isEditMode={isEditMode}
                        onOpenSettings={() => setModalState(prev => ({...prev, isSettings: true}))} onOpenUserManager={() => setModalState(prev => ({...prev, isUserManager: true}))}
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
                {/* Header for Desktop POS/Kitchen staff */}
                {isDesktop && !isAdminViewOnDesktop && (
                    <Header
                        currentView={currentView} onViewChange={setCurrentView} isEditMode={isEditMode} onToggleEditMode={() => setIsEditMode(!isEditMode)}
                        onOpenSettings={() => setModalState(prev => ({ ...prev, isSettings: true }))} cookingBadgeCount={cookingBadgeCount} waitingBadgeCount={waitingBadgeCount}
                        tablesBadgeCount={tablesBadgeCount} vacantTablesBadgeCount={vacantTablesCount} leaveBadgeCount={leaveBadgeCount} stockBadgeCount={stockBadgeCount} 
                        maintenanceBadgeCount={maintenanceBadgeCount} currentUser={currentUser} onLogout={handleLogout}
                        onOpenUserManager={() => setModalState(prev => ({ ...prev, isUserManager: true }))} 
                        logoUrl={appLogoUrl || logoUrl} // Prioritize App Logo (Red)
                        onLogoChangeClick={() => {}}
                        restaurantName={restaurantName} onRestaurantNameChange={setRestaurantName} branchName={selectedBranch.name}
                        onChangeBranch={() => setSelectedBranch(null)} onManageBranches={() => setModalState(prev => ({ ...prev, isBranchManager: true }))}
                        printerConfig={printerConfig}
                        isAutoPrintEnabled={isAutoPrintEnabled}
                        onToggleAutoPrint={toggleAutoPrint}
                    />
                )}
                
                <main className={`flex-1 flex overflow-hidden ${!isDesktop ? 'pb-16' : ''}`}>
                    {/* ... (Keep POS View logic) ... */}
                    {currentView === 'pos' && isDesktop && (
                        <div className="flex-1 flex overflow-hidden relative">
                            <div className="flex-1 overflow-y-auto">
                                <Menu
                                    menuItems={menuItems} setMenuItems={setMenuItems} categories={categories} onSelectItem={handleAddItemToOrder}
                                    isEditMode={isEditMode} onEditItem={(item) => { setItemToEdit(item); setModalState(prev => ({...prev, isMenuItem: true})); }}
                                    onAddNewItem={() => { setItemToEdit(null); setModalState(prev => ({...prev, isMenuItem: true})); }}
                                    onDeleteItem={handleDeleteMenuItem} onUpdateCategory={handleUpdateCategory} onDeleteCategory={handleDeleteCategory}
                                    onAddCategory={handleAddCategory} onImportMenu={(items, cats) => { setMenuItems(items); setCategories(prev => Array.from(new Set([...prev, ...cats]))); }}
                                    recommendedMenuItemIds={recommendedMenuItemIds}
                                    onToggleVisibility={handleToggleVisibility}
                                    // New Props for Toggle Button in Menu
                                    onToggleOrderSidebar={() => setIsOrderSidebarVisible(!isOrderSidebarVisible)}
                                    isOrderSidebarVisible={isOrderSidebarVisible}
                                    cartItemCount={totalCartItemCount}
                                />
                            </div>
                            <aside className={`flex-shrink-0 transition-all duration-300 overflow-hidden ${isOrderSidebarVisible ? 'w-96' : 'w-0'}`}>
                                {isOrderSidebarVisible && (
                                    <Sidebar
                                        currentOrderItems={currentOrderItems} onQuantityChange={handleQuantityChange} onRemoveItem={handleRemoveItem} onClearOrder={handleClearOrder}
                                        onPlaceOrder={handlePlaceOrder} isPlacingOrder={isPlacingOrder} tables={tables} selectedTable={selectedTable} onSelectTable={setSelectedTableId}
                                        customerName={customerName} onCustomerNameChange={setCustomerName} customerCount={customerCount} onCustomerCountChange={setCustomerCount}
                                        isEditMode={isEditMode} onAddNewTable={handleAddTable} onRemoveLastTable={handleRemoveLastTable} floors={floors} selectedFloor={selectedSidebarFloor}
                                        onFloorChange={setSelectedSidebarFloor} onAddFloor={handleAddFloor} onRemoveFloor={handleRemoveFloor} sendToKitchen={sendToKitchen}
                                        onSendToKitchenChange={(enabled, details) => { setSendToKitchen(enabled); setNotSentToKitchenDetails(details); }}
                                        onUpdateReservation={(tableId, reservation) => setTables(prev => prev.map(t => t.id === tableId ? {...t, reservation} : t))}
                                        onOpenSearch={() => setModalState(prev => ({...prev, isMenuSearch: true}))} currentUser={currentUser} onEditOrderItem={handleUpdateOrderItem}
                                        onViewChange={setCurrentView} restaurantName={restaurantName} onLogout={handleLogout}
                                        onToggleAvailability={handleToggleAvailability}
                                        isOrderNotificationsEnabled={isOrderNotificationsEnabled}
                                        onToggleOrderNotifications={toggleOrderNotifications}
                                        deliveryProviders={deliveryProviders}
                                        onOpenSettings={() => setModalState(prev => ({ ...prev, isSettings: true }))}
                                    />
                                )}
                            </aside>
                            {/* Old Floating Button Removed */}
                        </div>
                    )}

                    {!isDesktop && (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {currentView === 'pos' ? (
                                <div className="w-full flex flex-col h-full overflow-hidden">
                                    <Sidebar
                                        isMobilePage={true} currentOrderItems={currentOrderItems} onQuantityChange={handleQuantityChange} onRemoveItem={handleRemoveItem}
                                        onClearOrder={handleClearOrder} onPlaceOrder={handlePlaceOrder} isPlacingOrder={isPlacingOrder} tables={tables} selectedTable={selectedTable}
                                        onSelectTable={setSelectedTableId} customerName={customerName} onCustomerNameChange={setCustomerName} customerCount={customerCount}
                                        onCustomerCountChange={setCustomerCount} isEditMode={isEditMode} onAddNewTable={handleAddTable} onRemoveLastTable={handleRemoveLastTable}
                                        floors={floors} selectedFloor={selectedSidebarFloor} onFloorChange={setSelectedSidebarFloor} onAddFloor={handleAddFloor} onRemoveFloor={handleRemoveFloor}
                                        sendToKitchen={sendToKitchen} onSendToKitchenChange={(enabled, details) => { setSendToKitchen(enabled); setNotSentToKitchenDetails(details); }}
                                        onUpdateReservation={(tableId, reservation) => setTables(prev => prev.map(t => t.id === tableId ? {...t, reservation} : t))}
                                        onOpenSearch={() => setModalState(prev => ({...prev, isMenuSearch: true}))} currentUser={currentUser} onEditOrderItem={handleUpdateOrderItem}
                                        onViewChange={setCurrentView} restaurantName={restaurantName} onLogout={handleLogout}
                                        onToggleAvailability={handleToggleAvailability}
                                        isOrderNotificationsEnabled={isOrderNotificationsEnabled}
                                        onToggleOrderNotifications={toggleOrderNotifications}
                                        deliveryProviders={deliveryProviders}
                                        onToggleEditMode={() => setIsEditMode(!isEditMode)}
                                        onOpenSettings={() => setModalState(prev => ({ ...prev, isSettings: true }))}
                                    />
                                </div>
                            ) : (
                                <div className="w-full flex flex-col h-full">
                                    <MobileHeader 
                                        user={currentUser!} 
                                        restaurantName={restaurantName} 
                                        onOpenSearch={() => setModalState(prev => ({...prev, isMenuSearch: true}))} 
                                        onProfileClick={handleMobileProfileClick}
                                        isOrderNotificationsEnabled={isOrderNotificationsEnabled}
                                        onToggleOrderNotifications={toggleOrderNotifications}
                                        onOpenSettings={() => setModalState(prev => ({ ...prev, isSettings: true }))}
                                    />
                                    <div className="flex-1 overflow-y-auto">
                                        <Suspense fallback={<PageLoading />}>
                                            {/* KitchenView passed with NEW Props */}
                                            {currentView === 'kitchen' && (
                                                <KitchenView 
                                                    activeOrders={activeOrders} 
                                                    onCompleteOrder={handleCompleteOrder} 
                                                    onStartCooking={handleStartCooking} 
                                                    onPrintOrder={handlePrintKitchenOrder}
                                                    isAutoPrintEnabled={isAutoPrintEnabled} // Pass prop
                                                    onToggleAutoPrint={toggleAutoPrint}     // Pass handler
                                                />
                                            )}
                                            {/* ... Other mobile views ... */}
                                            {currentView === 'tables' && <TableLayout tables={tables} activeOrders={activeOrders} onTableSelect={(id) => { setSelectedTableId(id); setCurrentView('pos'); }} onShowBill={handleShowBill} onGeneratePin={handleGeneratePin} currentUser={currentUser} printerConfig={printerConfig} floors={floors} selectedBranch={selectedBranch} restaurantName={restaurantName} logoUrl={logoUrl} />}
                                            {currentView === 'dashboard' && <Dashboard completedOrders={completedOrders} cancelledOrders={cancelledOrders} openingTime={openingTime || '10:00'} closingTime={closingTime || '22:00'} currentUser={currentUser} />}
                                            {currentView === 'history' && <SalesHistory completedOrders={completedOrders} cancelledOrders={cancelledOrders} printHistory={printHistory} onReprint={() => {}} onSplitOrder={(order) => {setOrderForModal(order); setModalState(prev => ({...prev, isSplitCompleted: true}))}} isEditMode={isEditMode} onEditOrder={(order) => {setOrderForModal(order); setModalState(prev => ({...prev, isEditCompleted: true}))}} onInitiateCashBill={(order) => {setOrderForModal(order); setModalState(prev => ({...prev, isCashBill: true}))}} onDeleteHistory={handleDeleteHistory} currentUser={currentUser} onReprintReceipt={handleReprintReceipt} />}
                                            {currentView === 'stock' && <StockManagement stockItems={stockItems} setStockItems={setStockItems} stockCategories={stockCategories} setStockCategories={setStockCategories} stockUnits={stockUnits} setStockUnits={setStockUnits} currentUser={currentUser} />}
                                            {currentView === 'stock-analytics' && <StockAnalytics stockItems={stockItems} />}
                                            {currentView === 'leave' && <LeaveCalendarView leaveRequests={leaveRequests} currentUser={currentUser} onOpenRequestModal={(date) => { setLeaveRequestInitialDate(date); setModalState(prev => ({...prev, isLeaveRequest: true})); }} branches={branches} onUpdateStatus={(id, status) => setLeaveRequests(prev => prev.map(r => r.id === id ? {...r, status} : r))} onDeleteRequest={async (id) => {setLeaveRequests(prev => prev.filter(r => r.id !== id)); return true;}} selectedBranch={selectedBranch} />}
                                            {currentView === 'leave-analytics' && <LeaveAnalytics leaveRequests={leaveRequests} users={users} />}
                                            {currentView === 'maintenance' && (
                                                <MaintenanceView 
                                                    maintenanceItems={maintenanceItems}
                                                    setMaintenanceItems={setMaintenanceItems}
                                                    maintenanceLogs={maintenanceLogs}
                                                    setMaintenanceLogs={setMaintenanceLogs}
                                                    currentUser={currentUser}
                                                    isEditMode={isEditMode}
                                                />
                                            )}
                                        </Suspense>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Desktop Other Views */}
                    {isDesktop && currentView !== 'pos' && (
                        <Suspense fallback={<PageLoading />}>
                            {/* KitchenView passed with NEW Props */}
                            {currentView === 'kitchen' && (
                                <KitchenView 
                                    activeOrders={activeOrders} 
                                    onCompleteOrder={handleCompleteOrder} 
                                    onStartCooking={handleStartCooking} 
                                    onPrintOrder={handlePrintKitchenOrder}
                                    isAutoPrintEnabled={isAutoPrintEnabled} // Pass prop
                                    onToggleAutoPrint={toggleAutoPrint}     // Pass handler
                                />
                            )}
                            {currentView === 'tables' && <TableLayout tables={tables} activeOrders={activeOrders} onTableSelect={(id) => { setSelectedTableId(id); setCurrentView('pos'); }} onShowBill={handleShowBill} onGeneratePin={handleGeneratePin} currentUser={currentUser} printerConfig={printerConfig} floors={floors} selectedBranch={selectedBranch} restaurantName={restaurantName} logoUrl={logoUrl} />}
                            {currentView === 'dashboard' && <Dashboard completedOrders={completedOrders} cancelledOrders={cancelledOrders} openingTime={openingTime || '10:00'} closingTime={closingTime || '22:00'} currentUser={currentUser} />}
                            {currentView === 'history' && <SalesHistory completedOrders={completedOrders} cancelledOrders={cancelledOrders} printHistory={printHistory} onReprint={() => {}} onSplitOrder={(order) => {setOrderForModal(order); setModalState(prev => ({...prev, isSplitCompleted: true}))}} isEditMode={isEditMode} onEditOrder={(order) => {setOrderForModal(order); setModalState(prev => ({...prev, isEditCompleted: true}))}} onInitiateCashBill={(order) => {setOrderForModal(order); setModalState(prev => ({...prev, isCashBill: true}))}} onDeleteHistory={handleDeleteHistory} currentUser={currentUser} onReprintReceipt={handleReprintReceipt} />}
                            {currentView === 'stock' && <StockManagement stockItems={stockItems} setStockItems={setStockItems} stockCategories={stockCategories} setStockCategories={setStockCategories} stockUnits={stockUnits} setStockUnits={setStockUnits} currentUser={currentUser} />}
                            {currentView === 'stock-analytics' && <StockAnalytics stockItems={stockItems} />}
                            {currentView === 'leave' && <LeaveCalendarView leaveRequests={leaveRequests} currentUser={currentUser} onOpenRequestModal={(date) => { setLeaveRequestInitialDate(date); setModalState(prev => ({...prev, isLeaveRequest: true})); }} branches={branches} onUpdateStatus={(id, status) => setLeaveRequests(prev => prev.map(r => r.id === id ? {...r, status} : r))} onDeleteRequest={async (id) => {setLeaveRequests(prev => prev.filter(r => r.id !== id)); return true;}} selectedBranch={selectedBranch} />}
                            {currentView === 'leave-analytics' && <LeaveAnalytics leaveRequests={leaveRequests} users={users} />}
                            {currentView === 'maintenance' && (
                                <MaintenanceView 
                                    maintenanceItems={maintenanceItems}
                                    setMaintenanceItems={setMaintenanceItems}
                                    maintenanceLogs={maintenanceLogs}
                                    setMaintenanceLogs={setMaintenanceLogs}
                                    currentUser={currentUser}
                                    isEditMode={isEditMode}
                                />
                            )}
                        </Suspense>
                    )}
                </main>
            </div>
            
            {!isDesktop && currentUser && <BottomNavBar items={mobileNavItems} currentView={currentView} onViewChange={setCurrentView} />}

            {/* Modals ... (Keep existing modals) ... */}
            <LoginModal isOpen={false} onClose={() => {}} />
            <MenuItemModal isOpen={modalState.isMenuItem} onClose={handleModalClose} onSave={handleSaveMenuItem} itemToEdit={itemToEdit} categories={categories} onAddCategory={handleAddCategory} />
            <OrderSuccessModal isOpen={modalState.isOrderSuccess} onClose={handleModalClose} orderId={lastPlacedOrderId!} />
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
            <MergeBillModal isOpen={modalState.isMergeBill} onClose={handleModalClose} order={orderForModal as ActiveOrder} allActiveOrders={activeOrders} tables={tables} onConfirmMerge={handleConfirmMerge} />
        </div>
    );
};

export default App;
