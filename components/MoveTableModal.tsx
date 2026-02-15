import React, { useState, useMemo } from 'react';
import type { ActiveOrder, Table } from '../types';

interface MoveTableModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: ActiveOrder | null;
    tables: Table[];
    activeOrders: ActiveOrder[];
    onConfirmMove: (orderId: number, newTableId: number) => void;
    floors: string[];
}

export const MoveTableModal: React.FC<MoveTableModalProps> = ({
    isOpen,
    onClose,
    order,
    tables,
    activeOrders,
    onConfirmMove,
    floors,
}) => {
    const [selectedFloor, setSelectedFloor] = useState<string>('');
    const [selectedTableId, setSelectedTableId] = useState<number | null>(null);

    const occupiedTableIds = useMemo(() => {
        const tableIds = new Set<number>();
        for (const o of activeOrders) {
            // Find the table object corresponding to the order to get its unique ID
            const tableForOrder = tables.find(t => t.name === o.tableName && t.floor === o.floor);
            if (tableForOrder) {
                tableIds.add(tableForOrder.id);
            }
        }
        return tableIds;
    }, [activeOrders, tables]);

    // Filter tables to show only vacant ones on the selected floor
    const availableTables = useMemo(() => {
        return tables.filter(
            t => t.floor === selectedFloor && !occupiedTableIds.has(t.id)
        );
    }, [tables, selectedFloor, occupiedTableIds]);


    // Reset state when modal opens or order changes
    React.useEffect(() => {
        if (order) {
            setSelectedFloor(order.floor);
            setSelectedTableId(null);
        }
    }, [order]);

    if (!isOpen || !order) return null;

    const handleConfirm = () => {
        if (selectedTableId !== null) {
            onConfirmMove(order.id, selectedTableId);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md transform transition-all flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-6 border-b">
                    <h3 className="text-2xl font-bold text-gray-900">ย้ายโต๊ะ</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        ย้ายออเดอร์ #{order.orderNumber} จากโต๊ะ {order.tableName} ไปยังโต๊ะใหม่
                    </p>
                </header>

                <main className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">เลือกชั้น:</label>
                        <div className="grid grid-cols-2 gap-2">
                            {floors.map(floor => (
                                <button
                                    key={floor}
                                    onClick={() => setSelectedFloor(floor)}
                                    className={`py-2 px-4 rounded-md font-semibold transition-colors ${selectedFloor === floor ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
                                >
                                    {floor}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">เลือกโต๊ะใหม่ (เฉพาะโต๊ะที่ว่าง):</label>
                        {availableTables.length > 0 ? (
                             <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 bg-gray-50 rounded-md">
                                {availableTables.map(table => (
                                    <button
                                        key={table.id}
                                        onClick={() => setSelectedTableId(table.id)}
                                        className={`p-3 rounded-md font-bold text-lg border-2 transition-colors ${selectedTableId === table.id ? 'bg-green-500 border-green-600 text-white' : 'bg-white border-gray-300 text-gray-800 hover:border-blue-400'}`}
                                    >
                                        {table.name}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-gray-500 p-4 bg-gray-100 rounded-md">ไม่มีโต๊ะว่างในชั้นนี้</p>
                        )}
                    </div>
                </main>

                <footer className="bg-gray-50 px-6 py-4 flex justify-end gap-3 rounded-b-lg border-t">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-semibold">
                        ยกเลิก
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={selectedTableId === null}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold disabled:bg-gray-400"
                    >
                        ยืนยันการย้าย
                    </button>
                </footer>
            </div>
        </div>
    );
};