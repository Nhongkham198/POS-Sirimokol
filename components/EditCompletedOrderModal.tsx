
import React, { useState, useEffect, useMemo } from 'react';
import type { OrderItem, CompletedOrder, MenuItem } from '../types';
import Swal from 'sweetalert2';
import { ItemCustomizationModal } from './ItemCustomizationModal';

interface EditCompletedOrderModalProps {
    isOpen: boolean;
    order: CompletedOrder | null;
    onClose: () => void;
    onSave: (updatedOrder: { id: number; items: OrderItem[] }) => void;
    menuItems: MenuItem[];
}

export const EditCompletedOrderModal: React.FC<EditCompletedOrderModalProps> = ({ isOpen, order, onClose, onSave, menuItems }) => {
    const [editedItems, setEditedItems] = useState<OrderItem[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [itemToCustomize, setItemToCustomize] = useState<MenuItem | null>(null);

    useEffect(() => {
        if (order) {
            // Deep copy to prevent modifying original state directly
            setEditedItems(JSON.parse(JSON.stringify(order.items)));
            setIsAdding(false);
            setSearchTerm('');
        }
    }, [order]);

    const handleQuantityChange = (cartItemId: string, delta: number) => {
        setEditedItems(currentItems => {
            const newItems = [...currentItems];
            const itemIndex = newItems.findIndex(i => i.cartItemId === cartItemId);
            if (itemIndex > -1) {
                const newQuantity = newItems[itemIndex].quantity + delta;
                if (newQuantity > 0) {
                    newItems[itemIndex].quantity = newQuantity;
                } else {
                    // Remove if quantity is 0 or less
                    newItems.splice(itemIndex, 1);
                }
            }
            return newItems;
        });
    };

    const handleAddItem = (menuItem: MenuItem) => {
        // If the item has options, open the customization modal
        if (menuItem.optionGroups && menuItem.optionGroups.length > 0) {
            setItemToCustomize(menuItem);
            return;
        }

        // Direct add for simple items
        const cartItemId = `${menuItem.id}`;

        setEditedItems(currentItems => {
            const existingItem = currentItems.find(i => i.cartItemId === cartItemId);
            if (existingItem) {
                return currentItems.map(i => i.cartItemId === cartItemId ? { ...i, quantity: i.quantity + 1 } : i);
            } else {
                const newOrderItem: OrderItem = {
                    ...menuItem,
                    quantity: 1,
                    isTakeaway: false,
                    cartItemId: cartItemId,
                    finalPrice: menuItem.price,
                    selectedOptions: []
                };
                return [...currentItems, newOrderItem];
            }
        });
    };

    const handleConfirmCustomization = (itemToAdd: OrderItem) => {
        setEditedItems(currentItems => {
            const existingItem = currentItems.find(i => i.cartItemId === itemToAdd.cartItemId);
            if (existingItem) {
                return currentItems.map(i => i.cartItemId === itemToAdd.cartItemId ? { ...i, quantity: i.quantity + itemToAdd.quantity } : i);
            }
            return [...currentItems, itemToAdd];
        });
        setItemToCustomize(null);
    };
    
    const filteredMenuItems = useMemo(() => {
        if (!searchTerm) return [];
        return menuItems.filter(item => 
            item.name.toLowerCase().includes(searchTerm.toLowerCase())
            // Removed filtering out existing items to allow adding multiple with different options
        ).slice(0, 5); 
    }, [searchTerm, menuItems]);

    const handleSubmit = () => {
        if (!order) return;
        
        if (editedItems.length === 0) {
            if (!window.confirm('ออเดอร์นี้จะไม่มีรายการอาหารเหลืออยู่ คุณต้องการบันทึกหรือไม่?')) {
                return;
            }
        }
        onSave({ id: order.id, items: editedItems });
        
        Swal.fire({
            icon: 'success',
            title: 'บันทึกสำเร็จ',
            text: 'แก้ไขออเดอร์เรียบร้อยแล้ว',
            timer: 1500,
            showConfirmButton: false
        });
        onClose();
    };

    if (!isOpen || !order) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
                <div className="bg-white rounded-lg shadow-xl w-full max-w-lg transform transition-all flex flex-col" style={{maxHeight: '90vh'}} onClick={e => e.stopPropagation()}>
                    <div className="p-6 border-b">
                        <h3 className="text-2xl font-bold text-gray-900">แก้ไขออเดอร์ (ประวัติ)</h3>
                        <p className="text-sm text-gray-500 mt-1">
                            ออเดอร์ #{order.orderNumber}
                        </p>
                    </div>
                    
                    <div className="p-6 space-y-4 overflow-y-auto flex-1">
                        {editedItems.length === 0 && !isAdding && (
                            <p className="text-center text-gray-500 py-8">ไม่มีรายการอาหารในออเดอร์นี้</p>
                        )}
                        {editedItems.map(item => (
                            <div key={item.cartItemId} className="flex items-center bg-gray-50 p-3 rounded-lg">
                                <img src={item.imageUrl} alt={item.name} className="w-14 h-14 rounded-md object-cover mr-4" />
                                <div className="flex-grow">
                                    <p className="font-semibold text-gray-800">
                                        {item.name} 
                                        {item.selectedOptions && item.selectedOptions.length > 0 && (
                                            <span className="text-xs text-gray-500 block">
                                                ({item.selectedOptions.map(o => o.name).join(', ')})
                                            </span>
                                        )}
                                        {item.notes && <span className="text-xs text-blue-500 block">Note: {item.notes}</span>}
                                    </p>
                                    <p className="text-sm text-gray-500">{item.finalPrice.toLocaleString()} ฿</p>
                                </div>
                                <div className="flex items-center gap-2 text-gray-800">
                                    <button
                                        onClick={() => handleQuantityChange(item.cartItemId, -1)}
                                        className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors flex items-center justify-center font-bold"
                                    >-</button>
                                    <span className="w-10 text-center font-bold text-lg">{item.quantity}</span>
                                    <button
                                        onClick={() => handleQuantityChange(item.cartItemId, 1)}
                                        className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors flex items-center justify-center font-bold"
                                    >+</button>
                                </div>
                            </div>
                        ))}

                        <div className="mt-4 pt-4 border-t">
                            {isAdding ? (
                                <div className="space-y-2">
                                    <input 
                                        type="text"
                                        placeholder="ค้นหาเมนูเพื่อเพิ่ม..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        autoFocus
                                    />
                                    <div className="space-y-1 max-h-40 overflow-y-auto">
                                        {filteredMenuItems.map(menuItem => (
                                            <div 
                                                key={menuItem.id}
                                                onClick={() => handleAddItem(menuItem)}
                                                className="p-2 hover:bg-gray-100 rounded-md cursor-pointer"
                                            >
                                                {menuItem.name} - {menuItem.price} ฿
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={() => setIsAdding(false)} className="text-sm text-gray-600 hover:text-gray-800 font-medium">ปิด</button>
                                </div>
                            ) : (
                                <button onClick={() => setIsAdding(true)} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:bg-gray-100 hover:border-gray-400 transition-colors">
                                    + เพิ่มรายการอาหาร
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 rounded-b-lg border-t">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-semibold">
                            ยกเลิก
                        </button>
                        <button 
                            type="button" 
                            onClick={handleSubmit} 
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold"
                        >
                            บันทึกการแก้ไข
                        </button>
                    </div>
                </div>
            </div>

            {itemToCustomize && (
                <ItemCustomizationModal 
                    isOpen={true} 
                    onClose={() => setItemToCustomize(null)} 
                    item={itemToCustomize} 
                    onConfirm={handleConfirmCustomization} 
                />
            )}
        </>
    );
};
