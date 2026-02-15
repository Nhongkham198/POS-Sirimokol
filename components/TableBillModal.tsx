
import React, { useState, useEffect, useMemo } from 'react';
import type { ActiveOrder, OrderItem, User } from '../types';
import Swal from 'sweetalert2';

interface TableBillModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: ActiveOrder | null;
    onInitiatePayment: (order: ActiveOrder) => void;
    onInitiateMove: (order: ActiveOrder) => void;
    onSplit: (order: ActiveOrder) => void;
    isEditMode: boolean;
    onUpdateOrder: (orderId: number, items: OrderItem[], customerCount: number) => void;
    currentUser: User | null;
    onInitiateCancel: (order: ActiveOrder) => void;
    activeOrders: ActiveOrder[]; // Changed from count to full array to find siblings
    onInitiateMerge: (order: ActiveOrder) => void;
    onMergeAndPay: (sourceOrderIds: number[], targetOrderId: number) => void; // New prop for auto-merge
}

export const TableBillModal: React.FC<TableBillModalProps> = ({
    isOpen,
    onClose,
    order,
    onInitiatePayment,
    onInitiateMove,
    onSplit,
    isEditMode,
    onUpdateOrder,
    currentUser,
    onInitiateCancel,
    activeOrders,
    onInitiateMerge,
    onMergeAndPay,
}) => {
    const [editedItems, setEditedItems] = useState<OrderItem[]>([]);
    const [editedCustomerCount, setEditedCustomerCount] = useState(1);
    
    // New state for Void Mode
    const [isVoidMode, setIsVoidMode] = useState(false);

    useEffect(() => {
        if (order) {
            setEditedItems(JSON.parse(JSON.stringify(order.items)));
            setEditedCustomerCount(order.customerCount);
            setIsVoidMode(false); // Reset void mode when order changes/opens
        }
    }, [order]);

    const { subtotal, tax, total } = useMemo(() => {
        if (!order) return { subtotal: 0, tax: 0, total: 0 };
        const items = isEditMode ? editedItems : order.items;
        const currentTaxRate = order.taxRate || 0;
        
        const currentSubtotal = items.reduce((sum, item) => sum + item.finalPrice * item.quantity, 0);
        const currentTax = currentTaxRate > 0 ? currentSubtotal * (currentTaxRate / 100) : 0;
        const currentTotal = currentSubtotal + currentTax;
        return { subtotal: currentSubtotal, tax: currentTax, total: currentTotal };
    }, [isEditMode, editedItems, order]);


    if (!isOpen || !order) {
        return null;
    }

    const handleQuantityChange = (cartItemId: string, newQuantity: number) => {
        setEditedItems(prev => {
            if (newQuantity <= 0) {
                return prev.filter(i => i.cartItemId !== cartItemId);
            }
            return prev.map(i => i.cartItemId === cartItemId ? { ...i, quantity: newQuantity } : i);
        });
    };
    
    const handleSave = () => {
        onUpdateOrder(order.id, editedItems, editedCustomerCount);
    };

    // New Function to handle Voiding specific items
    const handleVoidItem = (cartItemId: string, itemName: string) => {
        Swal.fire({
            title: 'ยืนยันการยกเลิกรายการ',
            html: `ต้องการยกเลิกเมนู <b>"${itemName}"</b> ออกจากบิลนี้ใช่หรือไม่?<br/><small style="color:red">รายการจะถูกลบออกจากครัวทันที</small>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'ใช่, ลบเลย',
            cancelButtonText: 'ไม่'
        }).then((result) => {
            if (result.isConfirmed) {
                // Filter out the item
                const newItems = order.items.filter(i => i.cartItemId !== cartItemId);
                
                // Immediately update the order
                onUpdateOrder(order.id, newItems, order.customerCount);
            }
        });
    };

    const handlePaymentClick = () => {
        // Find other active orders on the SAME table (same ID, same Floor/Name context)
        const siblingOrders = activeOrders.filter(o => 
            o.id !== order.id && 
            o.tableId === order.tableId && 
            o.tableName === order.tableName && 
            o.floor === order.floor
        );

        if (siblingOrders.length > 0) {
            Swal.fire({
                title: 'พบหลายบิลในโต๊ะนี้!',
                text: `มีอีก ${siblingOrders.length} บิลที่ยังไม่ชำระในโต๊ะ ${order.tableName} ท่านต้องการรวมบิลทั้งหมดเพื่อชำระครั้งเดียวหรือไม่?`,
                icon: 'info',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#716add', // Different color for "No, keep separate" to distinguish from "Cancel"
                confirmButtonText: 'ใช่, รวมบิลทั้งหมด',
                cancelButtonText: 'ไม่, จ่ายแยกบิลนี้',
                showDenyButton: true,
                denyButtonText: 'ยกเลิก',
                denyButtonColor: '#d33'
            }).then((result) => {
                if (result.isConfirmed) {
                    // Merge All Siblings INTO Current Order
                    const sourceIds = siblingOrders.map(s => s.id);
                    onMergeAndPay(sourceIds, order.id);
                } else if (result.dismiss === Swal.DismissReason.cancel) {
                    // User chose "No, keep separate"
                    onInitiatePayment(order);
                }
                // If Deny/Close, do nothing (stay on modal)
            });
        } else {
            // Single order, proceed as normal
            onInitiatePayment(order);
        }
    };

    const canCancel = !!currentUser;
    const itemsToRender = isEditMode ? editedItems : order.items;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md transform transition-all flex flex-col" style={{maxHeight: '90vh'}} onClick={e => e.stopPropagation()}>
                <header className={`p-4 border-b rounded-t-lg transition-colors ${isVoidMode ? 'bg-red-50' : 'bg-gray-50'}`}>
                    <h3 className={`text-2xl font-bold text-center ${isVoidMode ? 'text-red-700' : 'text-gray-800'}`}>
                        {isVoidMode ? 'ยกเลิกรายการอาหาร' : `บิลโต๊ะ ${order.tableName} (${order.floor})`}
                    </h3>
                    {order.customerName && !isVoidMode && (
                        <p className="text-lg text-gray-600 text-center font-semibold mt-1">
                            ลูกค้า: {order.customerName}
                        </p>
                    )}
                    <p className={`text-base text-center ${isVoidMode ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                        {isVoidMode ? 'แตะที่ปุ่มถังขยะเพื่อลบรายการ' : `ออเดอร์ #${String(order.orderNumber).padStart(3, '0')}`}
                    </p>
                </header>

                <main className="flex-1 overflow-y-auto p-4 space-y-3">
                    {isEditMode ? (
                        <div className="flex items-center gap-2 mb-4 p-2 bg-yellow-100 rounded-md">
                            <label htmlFor="customer-count-edit" className="text-base font-medium text-yellow-800">จำนวนลูกค้า:</label>
                            <input
                                type="number"
                                id="customer-count-edit"
                                value={editedCustomerCount}
                                onChange={(e) => setEditedCustomerCount(Math.max(1, Number(e.target.value)))}
                                min="1"
                                className="w-20 bg-white border border-yellow-300 text-base rounded-lg focus:ring-yellow-500 focus:border-yellow-500 block p-1.5 text-center"
                            />
                        </div>
                    ) : (
                        !isVoidMode && <p className="text-base text-gray-600 mb-2">ลูกค้า: {order.customerCount} คน</p>
                    )}

                    <div className="space-y-3">
                        {itemsToRender.map((item, index) => {
                             const currentOrderNum = item.originalOrderNumber ?? order.orderNumber;
                             const showHeader = index > 0 && currentOrderNum !== (itemsToRender[index - 1].originalOrderNumber ?? order.orderNumber);

                            return (
                                <React.Fragment key={item.cartItemId}>
                                    {showHeader && (
                                        <h4 className="text-sm font-semibold text-gray-500 pt-3 mt-3 border-t border-dashed">
                                            (จากบิล #{String(currentOrderNum).padStart(3, '0')})
                                        </h4>
                                    )}
                                    <div className={`flex items-center ${isVoidMode ? 'bg-red-50 p-2 rounded border border-red-100' : ''}`}>
                                        <span className={`text-sm font-semibold mr-3 px-2.5 py-1 rounded-full ${isVoidMode ? 'bg-white text-red-600 border border-red-200' : 'bg-gray-200 text-gray-700'}`}>
                                            {item.quantity}x
                                        </span>
                                        <div className="flex-grow">
                                            <p className={`font-medium text-base ${isVoidMode ? 'text-red-800' : 'text-gray-800'}`}>
                                                {item.name}
                                                {item.isTakeaway && <span className="text-purple-600 text-xs font-semibold ml-2">(กลับบ้าน)</span>}
                                            </p>
                                            {item.selectedOptions.length > 0 && (
                                                <p className="text-xs text-gray-500 pl-1">
                                                    {item.selectedOptions.map(o => o.name).join(', ')}
                                                </p>
                                            )}
                                            {item.notes && (
                                                <p className="text-xs text-blue-600 pl-1">
                                                    หมายเหตุ: {item.notes}
                                                </p>
                                            )}
                                            {isEditMode && <p className="text-sm text-gray-500">{item.finalPrice.toLocaleString()} ฿</p>}
                                        </div>
                                        
                                        {/* Void Mode Delete Button */}
                                        {isVoidMode && (
                                            <button 
                                                onClick={() => handleVoidItem(item.cartItemId, item.name)}
                                                className="p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 hover:text-red-700 transition-colors shadow-sm ml-2"
                                                title="ลบรายการนี้"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        )}

                                        {isEditMode ? (
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleQuantityChange(item.cartItemId, item.quantity - 1)} className="w-7 h-7 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center hover:bg-blue-600">-</button>
                                                <button onClick={() => handleQuantityChange(item.cartItemId, item.quantity + 1)} className="w-7 h-7 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center hover:bg-blue-600">+</button>
                                            </div>
                                        ) : (
                                            !isVoidMode && <p className="font-medium text-gray-800 text-base">{(item.quantity * item.finalPrice).toLocaleString()} ฿</p>
                                        )}
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </div>
                </main>

                <footer className="p-4 border-t bg-gray-50 rounded-b-lg space-y-3">
                    {!isVoidMode && (
                        <div className="space-y-1 text-base text-gray-800">
                            {tax > 0 && (
                                <>
                                    <div className="flex justify-between">
                                        <span>ยอดรวม (ก่อนภาษี)</span>
                                        <span>{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} ฿</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>ภาษี ({order.taxRate}%)</span>
                                        <span>{tax.toLocaleString(undefined, { minimumFractionDigits: 2 })} ฿</span>
                                    </div>
                                </>
                            )}
                             <div className="flex justify-between text-xl font-bold pt-1 border-t mt-1">
                                <span>ยอดสุทธิ</span>
                                <span>{total.toLocaleString(undefined, { minimumFractionDigits: 2 })} ฿</span>
                            </div>
                        </div>
                    )}
                    
                    {isEditMode ? (
                         <div className="grid grid-cols-2 gap-2 pt-2">
                            <button onClick={onClose} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-3 px-4 rounded-lg transition-colors">ยกเลิก</button>
                            <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors">บันทึกการแก้ไข</button>
                         </div>
                    ) : (
                        <div className="space-y-2 pt-2">
                            {/* Standard Buttons (Hide when in Void Mode) */}
                            {!isVoidMode && (
                                <>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => onInitiateMove(order)} className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-4 rounded-lg transition-colors">ย้ายโต๊ะ</button>
                                        <button onClick={() => onSplit(order)} className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-4 rounded-lg transition-colors">แยกบิล</button>
                                    </div>
                                    <button onClick={() => onInitiateMerge(order)} className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 px-4 rounded-lg transition-colors">รวมบิล</button>
                                    
                                    <button onClick={handlePaymentClick} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg transition-colors">ชำระเงิน</button>
                                </>
                            )}
                            
                            <div className={`grid ${isVoidMode ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
                                {!isVoidMode && <button onClick={onClose} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-3 px-4 rounded-lg transition-colors">ปิด</button>}
                                
                                {/* Void Mode Toggle Button */}
                                <button
                                    onClick={() => setIsVoidMode(!isVoidMode)}
                                    disabled={!canCancel && !isVoidMode}
                                    title="ยกเลิกบางรายการ"
                                    className={`font-bold py-3 px-4 rounded-lg transition-colors ${
                                        isVoidMode 
                                        ? 'bg-gray-500 hover:bg-gray-600 text-white w-full' 
                                        : 'bg-red-100 hover:bg-red-200 text-red-700 border border-red-200'
                                    }`}
                                >
                                    {isVoidMode ? 'เสร็จสิ้น / กลับ' : 'ยกเลิกบางรายการ'}
                                </button>
                            </div>

                            {!isVoidMode && (
                                <button
                                    onClick={() => onInitiateCancel(order)}
                                    disabled={!canCancel}
                                    title="ยกเลิกออเดอร์ทั้งบิล"
                                    className="w-full mt-2 text-red-500 hover:text-red-700 text-sm underline decoration-red-300 hover:decoration-red-700 transition-colors"
                                >
                                    ยกเลิกทั้งออเดอร์
                                </button>
                            )}
                        </div>
                    )}
                </footer>
            </div>
        </div>
    );
};
