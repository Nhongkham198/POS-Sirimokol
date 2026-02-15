
import React, { useState, useMemo } from 'react';
import type { CancelledOrder } from '../types';

interface CancelledOrderCardProps {
    order: CancelledOrder;
    isEditMode: boolean;
    isSelected: boolean;
    onToggleSelection: (orderId: number) => void;
}

export const CancelledOrderCard: React.FC<CancelledOrderCardProps> = ({ order, isEditMode, isSelected, onToggleSelection }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const totalValue = useMemo(() => {
        const subtotal = order.items.reduce((sum, item) => sum + item.finalPrice * item.quantity, 0);
        return subtotal + order.taxAmount;
    }, [order.items, order.taxAmount]);

    const cancellationDate = useMemo(() => new Date(order.cancellationTime).toLocaleString('th-TH'), [order.cancellationTime]);

    const cardClasses = useMemo(() => {
        if (order.isDeleted) {
            return "bg-red-50/50 rounded-lg shadow-md border border-red-200 overflow-hidden transition-colors opacity-70";
        }
        let base = "bg-white rounded-lg shadow-md border overflow-hidden transition-colors ";
        if (isEditMode && isSelected) {
            base += "border-red-400 bg-red-50 ring-2 ring-red-300";
        } else {
            base += "border-red-200";
        }
        return base;
    }, [isEditMode, isSelected, order.isDeleted]);

    return (
        <div className={cardClasses}>
            <header className={`p-4 flex justify-between items-center ${order.isDeleted ? 'bg-red-100/60' : 'bg-red-50'}`}>
                <div className="flex items-center gap-4 flex-1">
                    {isEditMode && (
                        <div className="p-2 flex-shrink-0">
                             <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => onToggleSelection(order.id)}
                                className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                            />
                        </div>
                    )}
                    <div className="flex-1 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                        <div className="flex items-baseline gap-2 flex-wrap">
                            <p className={`font-bold text-xl ${order.isDeleted ? 'text-red-700' : 'text-red-700'}`}>
                                <span className={order.isDeleted ? 'text-red-400' : 'text-gray-500'}>#</span>{String(order.orderNumber).padStart(3, '0')}
                            </p>
                            {/* Removed whitespace-nowrap to allow text to wrap naturally if it's too long */}
                            <p className={`font-semibold text-lg leading-tight ${order.isDeleted ? 'text-red-800' : 'text-gray-800'}`}>โต๊ะ {order.tableName} ({order.floor})</p>
                            {order.isDeleted && <span className="text-xs px-2 py-0.5 rounded-full bg-red-200 text-red-800 font-semibold">(ลบโดย: {order.deletedBy})</span>}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{cancellationDate}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                    <p className={`text-2xl font-bold ${order.isDeleted ? 'text-red-700' : 'text-red-700'}`}>{totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })} ฿</p>
                     <svg className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </div>
            </header>

            {isExpanded && (
                <div className={`p-4 border-t ${order.isDeleted ? 'text-gray-500' : ''}`}>
                    <div className="mb-4 text-base bg-red-100 p-3 rounded-md border border-red-200">
                        <p className="text-red-800"><strong>เหตุผล:</strong> {order.cancellationReason}</p>
                        {order.cancellationNotes && <p className="text-red-800 mt-1"><strong>หมายเหตุ:</strong> {order.cancellationNotes}</p>}
                        <p className="text-red-800 mt-1"><strong>ยกเลิกโดย:</strong> {order.cancelledBy}</p>
                    </div>

                     <div className="space-y-2">
                        <h4 className="font-semibold text-gray-700 mb-2">รายการอาหารที่ถูกยกเลิก</h4>
                        {order.items.map(item => (
                            <div key={item.cartItemId} className="text-base text-gray-700 py-1">
                                <div className="flex justify-between">
                                    <span>{item.quantity} x {item.name} {item.isTakeaway && '(กลับบ้าน)'}</span>
                                    <span>{(item.finalPrice * item.quantity).toLocaleString()} ฿</span>
                                </div>
                                { (item.selectedOptions.length > 0 || item.notes) &&
                                    <div className="pl-5 text-sm text-gray-500">
                                        {item.selectedOptions.length > 0 && <div>{item.selectedOptions.map(o => o.name).join(', ')}</div>}
                                        {item.notes && <div className="text-blue-600">** {item.notes}</div>}
                                    </div>
                                }
                                 {item.isTakeaway && item.takeawayCutlery && item.takeawayCutlery.length > 0 && (
                                    <div className="pl-5 text-sm text-purple-600">
                                         รับ: {item.takeawayCutlery.map(c => {
                                            if(c === 'spoon-fork') return 'ช้อนส้อม';
                                            if(c === 'chopsticks') return 'ตะเกียบ';
                                            if(c === 'other') return `อื่นๆ (${item.takeawayCutleryNotes})`;
                                            if(c === 'none') return 'ไม่รับ';
                                            return '';
                                        }).filter(Boolean).join(', ')}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
