
import { functions } from '@/firebaseConfig';
// FIX: Switched to Firebase v8 compatibility API. This uses functions.httpsCallable() instead of v9 modular function.
// import { httpsCallable } from 'firebase/functions';
import type { PaymentDetails, OrderItem, LeaveRequest, StockItem } from '@/types';

/*
--------------------------------------------------------------------------------
This file acts as the bridge between the frontend React app and the backend
Firebase Cloud Functions. By centralizing function calls here, we keep our
components clean and make it easy to manage our backend API.

This file serves as the definitive "API Contract" for backend developers.
--------------------------------------------------------------------------------
*/


// Types for function payloads and responses
// FIX: Export PlaceOrderPayload and change floor type to string
export interface PlaceOrderPayload {
    branchId: string;
    tableName: string;
    floor: string;
    customerCount: number;
    items: OrderItem[]; // Use full OrderItem for now to support the fallback logic
    orderType: 'dine-in' | 'takeaway' | 'lineman';
    taxRate: number;
    placedBy: string;
    sendToKitchen: boolean;
}

interface PlaceOrderResponse {
    success: boolean;
    orderNumber?: number;
    error?: string;
}

interface ConfirmPaymentPayload {
    branchId: string;
    orderId: number;
    paymentDetails: PaymentDetails;
}

interface ConfirmPaymentResponse {
    success: boolean;
    orderNumber?: number;
    error?: string;
}

// --- Leave Management Payloads ---
export interface SubmitLeaveRequestPayload {
    userId: number;
    username: string;
    branchId: number;
    startDate: number;
    endDate: number;
    type: 'sick' | 'personal' | 'vacation' | 'leave-without-pay' | 'other';
    reason: string;
    isHalfDay?: boolean;
}

interface UpdateLeaveStatusPayload {
    requestId: number;
    status: 'approved' | 'rejected';
    approverId: number;
}

interface DeleteLeaveRequestPayload {
    requestId: number;
}

// --- Stock Management Payloads ---
interface AddStockItemPayload {
    name: string;
    category: string;
    quantity: number;
    unit: string;
    reorderPoint: number;
    branchId: number; // Assuming stock is branch-specific or global
}

interface UpdateStockItemPayload {
    itemId: number;
    name: string;
    category: string;
    unit: string;
    reorderPoint: number;
}

interface AdjustStockQuantityPayload {
    itemId: number;
    adjustment: number; // Positive to add, negative to subtract
}

interface DeleteStockItemPayload {
    itemId: number;
}

interface GenericResponse {
    success: boolean;
    error?: string;
}

// Check if Firebase Functions is initialized
if (!functions) {
    console.error("Firebase Functions is not initialized. Please check your firebaseConfig.");
}

// Create callable function instances
// FIX: Use v8 httpsCallable syntax
const placeOrderFunction = functions ? functions.httpsCallable('placeOrder') : null;
const confirmPaymentFunction = functions ? functions.httpsCallable('confirmPayment') : null;

// Leave Management Functions
const submitLeaveRequestFunction = functions ? functions.httpsCallable('submitLeaveRequest') : null;
const updateLeaveStatusFunction = functions ? functions.httpsCallable('updateLeaveStatus') : null;
const deleteLeaveRequestFunction = functions ? functions.httpsCallable('deleteLeaveRequest') : null;

// Stock Management Functions
const addStockItemFunction = functions ? functions.httpsCallable('addStockItem') : null;
const updateStockItemFunction = functions ? functions.httpsCallable('updateStockItem') : null;
const adjustStockQuantityFunction = functions ? functions.httpsCallable('adjustStockQuantity') : null;
const deleteStockItemFunction = functions ? functions.httpsCallable('deleteStockItem') : null;


// Exported service object
export const functionsService = {
    /**
     * Calls the backend function to create a new order.
     */
    placeOrder: async (payload: PlaceOrderPayload): Promise<PlaceOrderResponse> => {
        if (!placeOrderFunction) {
             console.error("Attempted to call 'placeOrder' but Firebase Functions is not initialized.");
             throw { code: 'internal', message: 'Firebase Functions not initialized.' };
        }
        try {
            const result = await placeOrderFunction(payload);
            // FIX: Cast result data to the correct type for v8 API.
            return result.data as PlaceOrderResponse;
        } catch (error: any) {
            // Propagate the original error to be caught by the calling function, triggering the fallback.
            throw error;
        }
    },

    /**
     * Calls the backend function to confirm payment and move an order from active to completed.
     */
    confirmPayment: async (payload: ConfirmPaymentPayload): Promise<ConfirmPaymentResponse> => {
        if (!confirmPaymentFunction) {
             console.error("Attempted to call 'confirmPayment' but Firebase Functions is not initialized.");
             throw { code: 'internal', message: 'Firebase Functions not initialized.' };
        }
        try {
            const result = await confirmPaymentFunction(payload);
            // FIX: Cast result data to the correct type for v8 API.
            return result.data as ConfirmPaymentResponse;
        } catch (error: any) {
            throw error;
        }
    },

    /**
     * Submits a leave request to the backend.
     */
    submitLeaveRequest: async (payload: SubmitLeaveRequestPayload): Promise<GenericResponse> => {
        if (!submitLeaveRequestFunction) {
            throw { code: 'internal', message: 'Firebase Functions not initialized.' };
        }
        try {
            const result = await submitLeaveRequestFunction(payload);
            // FIX: Cast result data to the correct type for v8 API.
            return result.data as GenericResponse;
        } catch (error: any) {
            throw error;
        }
    },

    /**
     * Updates the status of a leave request.
     */
    updateLeaveStatus: async (payload: UpdateLeaveStatusPayload): Promise<GenericResponse> => {
        if (!updateLeaveStatusFunction) {
            throw { code: 'internal', message: 'Firebase Functions not initialized.' };
        }
        try {
            const result = await updateLeaveStatusFunction(payload);
            // FIX: Cast result data to the correct type for v8 API.
            return result.data as GenericResponse;
        } catch (error: any) {
            throw error;
        }
    },

    /**
     * Deletes a leave request.
     */
    deleteLeaveRequest: async (payload: DeleteLeaveRequestPayload): Promise<GenericResponse> => {
        if (!deleteLeaveRequestFunction) {
            throw { code: 'internal', message: 'Firebase Functions not initialized.' };
        }
        try {
            const result = await deleteLeaveRequestFunction(payload);
            // FIX: Cast result data to the correct type for v8 API.
            return result.data as GenericResponse;
        } catch (error: any) {
            throw error;
        }
    },

    // --- Stock Functions ---

    addStockItem: async (payload: AddStockItemPayload): Promise<GenericResponse> => {
        if (!addStockItemFunction) throw { code: 'internal', message: "Functions not initialized" };
        try {
            const result = await addStockItemFunction(payload);
            // FIX: Cast result data to the correct type for v8 API.
            return result.data as GenericResponse;
        } catch (error: any) { throw error; }
    },

    updateStockItem: async (payload: UpdateStockItemPayload): Promise<GenericResponse> => {
        if (!updateStockItemFunction) throw { code: 'internal', message: "Functions not initialized" };
        try {
            const result = await updateStockItemFunction(payload);
            // FIX: Cast result data to the correct type for v8 API.
            return result.data as GenericResponse;
        } catch (error: any) { throw error; }
    },

    adjustStockQuantity: async (payload: AdjustStockQuantityPayload): Promise<GenericResponse> => {
        if (!adjustStockQuantityFunction) throw { code: 'internal', message: "Functions not initialized" };
        try {
            const result = await adjustStockQuantityFunction(payload);
            // FIX: Cast result data to the correct type for v8 API.
            return result.data as GenericResponse;
        } catch (error: any) { throw error; }
    },

    deleteStockItem: async (payload: DeleteStockItemPayload): Promise<GenericResponse> => {
        if (!deleteStockItemFunction) throw { code: 'internal', message: "Functions not initialized" };
        try {
            const result = await deleteStockItemFunction(payload);
            // FIX: Cast result data to the correct type for v8 API.
            return result.data as GenericResponse;
        } catch (error: any) { throw error; }
    }

};
