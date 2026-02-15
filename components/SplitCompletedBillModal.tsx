

import React, { useState, useEffect } from 'react';
import type { OrderItem, CompletedOrder } from '../types';

interface SplitCompletedBillModalProps {
    isOpen: boolean;
    order: CompletedOrder | null;
    onClose: () => void;
    onConfirmSplit: (itemsToSplit: OrderItem[]) => void;
}

export const SplitCompletedBillModal: React.FC<SplitCompletedBillModalProps> = ({ isOpen, order, onClose, onConfirmSplit }) => {
    const [itemsToSplit, setItemsToSplit] = useState<Map<number, number>>(new Map());

    useEffect(() => {
        if (order) {
            setItemsToSplit(new Map());
        }
    }, [order]);

    const handleQuantityChange = (itemId: number, newQuantity: number) => {
        const originalItem = order?.items.find(item => item.id === itemId);
        if (!originalItem) return;

        const clampedQuantity = Math.max(0, Math.min(newQuantity, originalItem.quantity));

        setItemsToSplit(prevMap => {
            const newMap = new Map(prevMap);
            if (clampedQuantity > 0) {
                newMap.set(itemId, clampedQuantity);
            } else {
                newMap.delete(itemId);
            }
            return newMap;
        });
    };

    const handleSubmit = () => {
        if (!order) return;
        
        const splitItemsArray: OrderItem[] = [];
        itemsToSplit.forEach((quantity, itemId) => {
            const originalItem = order.items.find(item => item.id === itemId);
            if (originalItem) {
                splitItemsArray.push({ ...originalItem, quantity });
            }
        });

        if (splitItemsArray.length > 0) {
            onConfirmSplit(splitItemsArray);
        } else {
            alert("กรุณาเลือกรายการอาหารอย่างน้อย 1 อย่าง");
        }
    };

    // FIX: Add isOpen check to prevent rendering when not open
    if (!isOpen || !order) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg transform transition-all flex flex-col" style={{maxHeight: '90vh'}} onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b">
                    <h3 className="text-2xl font-bold text-gray-900">แยกบิล (ประวัติ)</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        แยกบิลออเดอร์ #{order.orderNumber} ที่ชำระเงินแล้ว
                    </p>
                </div>
                
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                    {order.items.map(item => {
                        const quantityToSplit = itemsToSplit.get(item.id) || 0;
                        return (
                            <div key={item.id} className="flex items-center bg-gray-50 p-3 rounded-lg">
                                <img src={item.imageUrl} alt={item.name} className="w-14 h-14 rounded-md object-cover mr-4" />
                                <div className="flex-grow">
                                    <p className="font-semibold text-gray-800">{item.name}</p>
                                    <p className="text-sm text-gray-500">{item.price.toLocaleString()} ฿ (มี {item.quantity})</p>
                                </div>
                                <div className="flex items-center gap-2 text-gray-800">
                                    <button
                                        onClick={() => handleQuantityChange(item.id, quantityToSplit - 1)}
                                        className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors flex items-center justify-center font-bold"
                                    >
                                        -
                                    </button>
                                    <span className="w-10 text-center font-bold text-lg">{quantityToSplit}</span>
                                    <button
                                        onClick={() => handleQuantityChange(item.id, quantityToSplit + 1)}
                                        className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors flex items-center justify-center font-bold"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 rounded-b-lg border-t">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-semibold">
                        ยกเลิก
                    </button>
                    <button 
                        type="button" 
                        onClick={handleSubmit} 
                        disabled={itemsToSplit.size === 0}
                        className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 font-semibold disabled:bg-gray-400"
                    >
                        ยืนยันการแยกบิล
                    </button>
                </div>
            </div>
        </div>
    );
};