import React, { useMemo } from 'react';
import type { OrderItem } from '../types';
import { OrderListItem } from './OrderListItem';

interface OrderSummaryProps {
    items: OrderItem[];
    // FIX: Update prop types to use string-based cartItemId to match OrderListItem.
    onQuantityChange: (cartItemId: string, newQuantity: number) => void;
    onRemoveItem: (cartItemId: string) => void;
}

export const OrderSummary: React.FC<OrderSummaryProps> = ({ items, onQuantityChange, onRemoveItem }) => {
    const total = useMemo(() => {
        return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    }, [items]);

    return (
        <div className="bg-white p-4 rounded-lg shadow-inner h-full flex flex-col">
            <h3 className="text-xl font-bold text-gray-800 border-b pb-2">รายการปัจจุบัน</h3>
            {items.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                    <p>ยังไม่มีรายการ</p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto space-y-2 py-2">
                    {items.map((item) => (
                        <OrderListItem
                            // FIX: Use the unique cartItemId for the key instead of the non-unique item.id.
                            key={item.cartItemId}
                            item={item}
                            onRemoveItem={onRemoveItem}
                            // OrderListItem requires onEditItem, but this summary view doesn't support it.
                            onEditItem={() => {}}
                        />
                    ))}
                </div>
            )}
            <div className="border-t pt-4">
                <div className="flex justify-between text-2xl font-bold">
                    <span>รวม</span>
                    <span>{total.toLocaleString()} ฿</span>
                </div>
            </div>
        </div>
    );
};