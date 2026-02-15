
import type { ReactNode } from 'react';

export interface Branch {
    id: number;
    name: string;
    location?: string;
}

export interface LeaveQuotas {
    sick: number;
    personal: number;
    vacation: number;
}

export interface DeliveryProvider {
    id: string;
    name: string;
    iconUrl: string; // URL for the logo
    color?: string; // New: Brand color for buttons/badges
    isEnabled: boolean;
    isDefault?: boolean; // System defaults like LineMan
}

export interface User {
    id: number;
    username: string;
    password: string;
    role: 'admin' | 'branch-admin' | 'pos' | 'kitchen' | 'auditor' | 'table'; // Added 'table' role
    allowedBranchIds?: number[];
    assignedTableId?: number; // Added: Specific table assignment for 'table' role
    profilePictureUrl?: string;
    leaveQuotas?: LeaveQuotas; // Added specific quotas per user
    fcmTokens?: string[]; // For Push Notifications on multiple devices
}

export interface MenuOption {
    id: string;
    name: string;
    nameEn?: string; // Added English Name field for Option
    priceModifier: number;
    isDefault?: boolean;
}

export interface MenuOptionGroup {
    id: string;
    name: string;
    nameEn?: string; // Added English Name field for Option Group
    selectionType: 'single' | 'multiple';
    required?: boolean;
    options: MenuOption[];
}

export interface MenuItem {
    id: number;
    name: string;
    nameEn?: string; // Added English Name field
    price: number;
    category: string;
    imageUrl: string;
    cookingTime?: number; // in minutes
    optionGroups?: MenuOptionGroup[];
    isAvailable?: boolean; // New property for stock status
    isVisible?: boolean; // New property for visibility on customer screen
}

export type TakeawayCutleryOption = 'spoon-fork' | 'chopsticks' | 'other' | 'none';

export interface OrderItem extends MenuItem {
    quantity: number;
    isTakeaway: boolean;
    cartItemId: string;
    finalPrice: number;
    selectedOptions: MenuOption[];
    notes?: string;
    takeawayCutlery?: TakeawayCutleryOption[];
    takeawayCutleryNotes?: string;
    originalOrderNumber?: number;
}

export interface PaymentDetails {
    method: 'cash' | 'transfer';
    cashReceived?: number;
    changeGiven?: number;
    slipImage?: string; // Base64 string or URL of the payment slip
}

interface BaseOrder {
    id: number;
    orderNumber: number;
    manualOrderNumber?: string | null; // NEW: Stores the manual input (e.g. LineMan #023)
    tableId: number;
    tableName: string;
    customerName?: string;
    floor: string;
    customerCount: number;
    items: OrderItem[];
    orderType: 'dine-in' | 'takeaway' | 'lineman';
    taxRate: number;
    taxAmount: number;
    placedBy: string;
    parentOrderId?: number | null;
    takeawayCutlery?: TakeawayCutleryOption[];
    takeawayCutleryNotes?: string;
    isDeleted?: boolean;
    deletedBy?: string;
    mergedOrderNumbers?: number[];
    splitCount?: number;
    isSplitChild?: boolean;
    splitIndex?: number;
}

export const CANCELLATION_REASONS = [
    'ลูกค้าขอยกเลิก',
    'ทำรายการผิดพลาด',
    'วัตถุดิบหมด',
    'อื่นๆ',
] as const;

export type CancellationReason = typeof CANCELLATION_REASONS[number];

export interface ActiveOrder extends BaseOrder {
    status: 'waiting' | 'cooking' | 'served' | 'completed' | 'cancelled';
    orderTime: number; // timestamp
    cookingStartTime?: number; // timestamp
    isOverdue?: boolean;
    isPrintedToKitchen?: boolean; // To prevent duplicate auto-prints
    // Fields allowed during transition to completed/cancelled within active collection
    completionTime?: number;
    paymentDetails?: PaymentDetails;
    cancellationTime?: number;
    cancelledBy?: string;
    cancellationReason?: CancellationReason;
    cancellationNotes?: string;
}

export interface CompletedOrder extends BaseOrder {
    status: 'completed';
    orderTime: number;
    completionTime: number; // timestamp
    paymentDetails: PaymentDetails;
    completedBy?: string; // Name of the staff who received the payment
}

export interface CancelledOrder extends BaseOrder {
    status: 'cancelled';
    orderTime: number;
    cancellationTime: number;
    cancelledBy: string;
    cancellationReason: CancellationReason;
    cancellationNotes?: string;
}

export interface Reservation {
    name: string;
    time: string;
    contact?: string;
}

export interface Table {
    id: number;
    name: string;
    floor: string;
    activePin?: string | null; // PIN code for customer self-service verification
    reservation?: Reservation | null;
}

export interface ReceiptPrintSettings {
    // Header
    showLogo: boolean;
    showRestaurantName: boolean;
    showAddress: boolean;
    address: string;
    showPhoneNumber: boolean;
    phoneNumber: string;
    
    // Meta Info
    showTable: boolean;
    showStaff: boolean;
    showDateTime: boolean;
    showOrderId: boolean;
    
    // Body
    showItems: boolean;
    
    // Footer / Totals
    showSubtotal: boolean;
    showTax: boolean;
    showTotal: boolean;
    showPaymentMethod: boolean;
    showThankYouMessage: boolean;
    thankYouMessage: string;
    showQrCode?: boolean;
}

export type PrinterConnectionType = 'network' | 'usb';

export interface KitchenPrinterSettings {
    connectionType: PrinterConnectionType;
    ipAddress: string; // The Node.js Server IP
    port?: string;     // The Node.js Server Port
    paperWidth: '58mm' | '80mm';
    // Network Settings
    targetPrinterIp?: string; // The Actual Printer IP (Hardware)
    targetPrinterPort?: string; // The Actual Printer Port (Hardware, usually 9100)
    // USB Settings (NEW)
    vid?: string; // Vendor ID (Hex)
    pid?: string; // Product ID (Hex)
}

export interface CashierPrinterSettings {
    connectionType: PrinterConnectionType;
    ipAddress: string;
    port?: string;
    paperWidth: '58mm' | '80mm';
    // Network Settings
    targetPrinterIp?: string;
    targetPrinterPort?: string;
    // USB Settings (NEW)
    vid?: string; 
    pid?: string;
    receiptOptions: ReceiptPrintSettings;
}

export interface PrinterConfig {
    kitchen: KitchenPrinterSettings | null;
    cashier: CashierPrinterSettings | null;
}

export interface StockItem {
    id: number;
    name: string;
    category: string;
    imageUrl?: string; // Added image URL support
    quantity: number;
    unit: string;
    reorderPoint: number;
    withdrawalCount?: number; // Count since last restock
    monthlyWithdrawals?: Record<string, number>; // History of withdrawals per month (Key: "YYYY-MM", Value: Count)
    lastUpdated: number; // timestamp
    lastUpdatedBy?: string; // Username of the person who last updated the item
    orderDate?: number; // timestamp
    receivedDate?: number; // timestamp
}

export interface LeaveRequest {
    id: number;
    userId: number;
    username: string;
    branchId: number; // Added to track branch
    startDate: number; // timestamp
    endDate: number; // timestamp
    type: 'sick' | 'personal' | 'vacation' | 'leave-without-pay' | 'other';
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    isHalfDay?: boolean; // Added support for half-day leave
    acknowledgedBy?: number[]; // IDs of admins/managers who have seen the notification
    submittedAt?: number; // timestamp for when the request was created
}

export interface StaffCall {
    id: number; // timestamp
    tableId: number;
    tableName: string;
    customerName: string;
    branchId: number;
    timestamp: number;
}

// --- NEW MAINTENANCE TYPES ---
export type MaintenanceStatus = 'active' | 'broken' | 'repairing';

export interface MaintenanceItem {
    id: number;
    name: string;
    imageUrl: string;
    description?: string;
    cycleMonths: number; // 1 or 3
    lastMaintenanceDate: number | null; // timestamp
    status?: MaintenanceStatus; // Operational status: active (normal), broken (broken), repairing (in repair)
}

export interface MaintenanceLog {
    id: number;
    itemId: number;
    maintenanceDate: number; // timestamp
    performedBy: string;
    notes?: string;
    beforeImage?: string; // Base64
    afterImage?: string; // Base64
}

export type View = 'pos' | 'kitchen' | 'tables' | 'dashboard' | 'history' | 'stock' | 'stock-analytics' | 'leave' | 'leave-analytics' | 'maintenance';

export interface NavItem {
    id: string;
    label: string;
    icon: ReactNode;
    view?: View;
    onClick?: () => void;
    disabled?: boolean;
    badge?: number;
    subItems?: NavItem[];
}

export interface PrintHistoryEntry {
    id: number; // timestamp for unique key
    timestamp: number;
    orderNumber: number;
    tableName: string;
    printedBy: string;
    printerType: 'kitchen' | 'receipt';
    status: 'success' | 'failed';
    errorMessage: string | null;
    orderItemsPreview: string[];
    isReprint: boolean;
    // ADD: Add soft delete properties
    isDeleted?: boolean; // Soft delete flag
    deletedBy?: string; // Username of the person who deleted it
}

export interface OrderCounter {
    count: number;
    lastResetDate: string; // YYYY-MM-DD format
}

export type PrinterStatus = 'idle' | 'checking' | 'success' | 'error';

export interface SystemPrinterStatus {
    kitchen: PrinterStatus;
    cashier: PrinterStatus;
}