

import React from 'react';
import type { OrderItem } from '../types';

interface OrderListItemProps {
    item: OrderItem;
    onRemoveItem: (cartItemId: string) => void;
    onEditItem: (item: OrderItem) => void;
}

export const OrderListItem: React.FC<OrderListItemProps> = ({ item, onRemoveItem, onEditItem }) => {
    
    const optionsText = item.selectedOptions.map(opt => opt.name).join(', ');

    return (
        <div className="flex items-start p-3 bg-gray-800 rounded-lg">
            <div className="flex-grow cursor-pointer" onClick={() => onEditItem(item)}>
                <p className="font-semibold text-white leading-tight">{item.name}</p>
                {optionsText && <p className="text-xs text-gray-400 pl-1">{optionsText}</p>}
                {item.notes && <p className="text-xs text-yellow-300 pl-1 mt-1">** {item.notes}</p>}
                <p className="text-sm text-gray-400 mt-1">{item.finalPrice.toLocaleString()} ฿</p>
            </div>
            <div className="flex items-center gap-3 text-white ml-2">
                <span className="font-bold text-lg">x{item.quantity}</span>
                 <button
                    onClick={() => onRemoveItem(item.cartItemId)}
                    className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors"
                    title="ลบรายการ"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>
        </div>
    );
};