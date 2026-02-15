
import React, { useState, useEffect, useMemo } from 'react';
import type { ActiveOrder } from '../types';

interface KitchenOrderCardProps {
    order: ActiveOrder;
    onCompleteOrder: (orderId: number) => void;
    onStartCooking: (orderId: number) => void;
    onPrintOrder: (orderId: number) => void;
}

const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export const KitchenOrderCard: React.FC<KitchenOrderCardProps> = ({ 
    order, 
    onCompleteOrder, 
    onStartCooking, 
    onPrintOrder
}) => {
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    
    // Checklist state: Persist to localStorage to survive page refreshes
    const [checkedItems, setCheckedItems] = useState<Set<string>>(() => {
        try {
            const saved = localStorage.getItem(`checklist_${order.id}`);
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch (e) {
            return new Set();
        }
    });

    useEffect(() => {
        const calculateElapsedTime = () => {
            if (order.status === 'cooking' && order.cookingStartTime) {
                return Math.floor((Date.now() - order.cookingStartTime) / 1000);
            }
            return Math.floor((Date.now() - order.orderTime) / 1000);
        };

        setElapsedSeconds(calculateElapsedTime());

        const timer = setInterval(() => {
            setElapsedSeconds(calculateElapsedTime());
        }, 1000);

        return () => clearInterval(timer);
    }, [order.status, order.orderTime, order.cookingStartTime]);

    const handleToggleItem = (cartItemId: string) => {
        setCheckedItems(prev => {
            const next = new Set(prev);
            if (next.has(cartItemId)) {
                next.delete(cartItemId);
            } else {
                next.add(cartItemId);
            }
            localStorage.setItem(`checklist_${order.id}`, JSON.stringify(Array.from(next)));
            return next;
        });
    };

    const handleComplete = () => {
        // Clean up storage when order is completed
        localStorage.removeItem(`checklist_${order.id}`);
        onCompleteOrder(order.id);
    };

    const handleStart = () => {
        onStartCooking(order.id);
    };

    const isCooking = order.status === 'cooking';
    const isOverdue = order.isOverdue ?? false;
    const isLineMan = order.orderType === 'lineman';
    const isTakeaway = order.orderType === 'takeaway' || order.items.some(i => i.isTakeaway);

    // KDS Style Colors & Labels
    const headerColor = useMemo(() => {
        if (isLineMan) {
            const providerName = (order.tableName || '').toLowerCase();
            if (providerName.includes('shopee')) return 'bg-orange-500'; // ShopeeFood = Orange
            if (providerName.includes('robin')) return 'bg-purple-600'; // Robinhood = Purple
            if (providerName.includes('panda')) return 'bg-pink-500'; // FoodPanda = Pink
            return 'bg-green-600'; // LineMan, Grab, others = Green (Default)
        }
        if (isOverdue) return 'bg-red-600';
        if (isCooking) return 'bg-green-600'; 
        return 'bg-blue-600'; // Waiting
    }, [isCooking, isOverdue, isLineMan, order.tableName]);

    const typeLabel = useMemo(() => {
        if (isLineMan) {
            const providerName = (order.tableName || '').toUpperCase();
            // Prevent "DELIVERY DELIVERY" if provider name is just "Delivery"
            if (providerName === 'DELIVERY') return 'DELIVERY';
            return `DELIVERY ${providerName}`;
        }
        return isTakeaway ? 'TAKE AWAY' : 'EAT IN';
    }, [isLineMan, isTakeaway, order.tableName]);
    
    // Display Logic: Use manual number if available (for LineMan), otherwise system order number
    const displayOrderNumber = order.manualOrderNumber ? `#${order.manualOrderNumber}` : `#${String(order.orderNumber).padStart(3, '0')}`;

    return (
        <div className="flex flex-col bg-gray-800 text-white rounded-lg overflow-hidden border-2 border-gray-700 shadow-xl h-full transform transition-all duration-200 hover:scale-[1.02]">
            
            {/* KDS Header */}
            <div className={`${headerColor} px-3 py-2 flex justify-between items-center`}>
                <div className="flex flex-col overflow-hidden">
                    <span className="text-xs font-bold opacity-80 uppercase tracking-wider truncate block w-full">{typeLabel}</span>
                    <span className="text-3xl font-black leading-none">{displayOrderNumber}</span>
                </div>
                <div className="flex flex-col items-end flex-shrink-0 ml-2">
                    <span className="text-3xl font-mono font-bold">{formatTime(elapsedSeconds)}</span>
                    <span className="text-xs font-bold opacity-90 truncate max-w-[100px]">{isLineMan ? 'Delivery' : `โต๊ะ ${order.tableName} (${order.floor})`}</span>
                </div>
            </div>

            {/* Sub Header: Info */}
            <div className="bg-gray-700 px-3 py-1 flex justify-between items-center text-xs text-gray-300 border-b border-gray-600">
                <span className="truncate">{order.customerName || 'ลูกค้าทั่วไป'}</span>
                <span>{order.placedBy}</span>
            </div>

            {/* Order Items List - NO SCROLL, FULL HEIGHT */}
            <div className="p-3 flex-1 flex flex-col gap-2">
                <ul className="space-y-3">
                    {order.items.map((item, idx) => {
                        const isChecked = checkedItems.has(item.cartItemId);
                        
                        return (
                            <li 
                                key={item.cartItemId || idx} 
                                className={`flex flex-col border-b border-gray-700 pb-2 last:border-0 last:pb-0 transition-all duration-200 ${isChecked ? 'opacity-40' : 'opacity-100'}`}
                            >
                                <div 
                                    className={`flex items-start justify-between ${isCooking ? 'cursor-pointer group' : ''}`}
                                    onClick={() => isCooking && handleToggleItem(item.cartItemId)}
                                >
                                    <div className="flex items-center gap-3 flex-1">
                                        {/* Checkbox Circle - Only show when cooking */}
                                        {isCooking && (
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                                isChecked 
                                                    ? 'bg-green-500 border-green-500' 
                                                    : 'border-gray-500 group-hover:border-gray-300'
                                            }`}>
                                                {isChecked && (
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </div>
                                        )}

                                        <span className={`font-bold text-lg leading-tight transition-colors ${
                                            isChecked ? 'text-gray-400 line-through' : 'text-white'
                                        }`}>
                                            {item.name}
                                        </span>
                                    </div>

                                    <span className={`font-black text-xl px-2 rounded ml-2 min-w-[2rem] text-center transition-colors ${
                                        isChecked 
                                            ? 'text-gray-500 bg-gray-800' 
                                            : 'text-yellow-400 bg-gray-700'
                                    }`}>
                                        {item.quantity}
                                    </span>
                                </div>
                                
                                <div className={`${isCooking ? 'pl-9' : 'pl-0'} transition-opacity ${isChecked ? 'opacity-50' : 'opacity-100'}`}>
                                    {(item.isTakeaway || isLineMan) && (
                                        <span className="text-xs font-bold text-purple-400 uppercase mt-0.5 block">*** กลับบ้าน ***</span>
                                    )}

                                    {(item.selectedOptions && item.selectedOptions.length > 0) && (
                                        <div className="text-sm text-cyan-300 mt-1 border-l-2 border-cyan-500/30 pl-2">
                                            {item.selectedOptions.map(opt => (
                                                <div key={opt.id}>+ {opt.name}</div>
                                            ))}
                                        </div>
                                    )}

                                    {item.notes && (
                                        <div className="text-sm font-bold text-red-300 bg-red-900/30 p-1 rounded mt-1 border border-red-800/50">
                                            Note: {item.notes}
                                        </div>
                                    )}

                                    {(item.isTakeaway || isLineMan) && item.takeawayCutlery && item.takeawayCutlery.length > 0 && (
                                        <div className="text-xs text-purple-300 mt-1">
                                            [รับ: {item.takeawayCutlery.map(c => 
                                                c === 'spoon-fork' ? 'ช้อนส้อม' : 
                                                c === 'chopsticks' ? 'ตะเกียบ' : 
                                                c === 'other' ? item.takeawayCutleryNotes : 
                                                'ไม่รับ'
                                            ).join(', ')}]
                                        </div>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>

            {/* Footer Action */}
            <div className="p-2 bg-gray-800 border-t border-gray-700 flex gap-2">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onPrintOrder(order.id);
                    }}
                    className="px-3 rounded bg-gray-700 hover:bg-gray-600 text-white border-2 border-gray-600 transition-colors flex items-center justify-center"
                    title="พิมพ์ใบออเดอร์อีกครั้ง"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                </button>

                {isCooking ? (
                    <button
                        onClick={handleComplete}
                        className="flex-1 bg-gray-700 hover:bg-green-600 text-white font-bold py-3 rounded text-xl uppercase tracking-widest transition-colors border-2 border-gray-600 hover:border-green-500"
                    >
                        {isLineMan ? 'COMPLETE (จบงาน)' : 'BUMP (เสิร์ฟ)'}
                    </button>
                ) : (
                    <button
                        onClick={handleStart}
                        className="flex-1 bg-gray-700 hover:bg-blue-600 text-white font-bold py-3 rounded text-xl uppercase tracking-widest transition-colors border-2 border-gray-600 hover:border-blue-500"
                    >
                        START
                    </button>
                )}
            </div>
        </div>
    );
};
