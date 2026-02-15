import React, { useState } from 'react';
import type { MenuItem } from '../types';

interface CategoryManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    categories: string[];
    menuItems: MenuItem[];
    onAddCategory: (name: string) => void;
    onUpdateCategory: (oldName: string, newName: string) => void;
    onDeleteCategory: (name: string) => void;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
    isOpen,
    onClose,
    categories,
    menuItems,
    onAddCategory,
    onUpdateCategory,
    onDeleteCategory
}) => {
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategory, setEditingCategory] = useState<{ oldName: string; newName: string } | null>(null);

    const handleAdd = () => {
        onAddCategory(newCategoryName);
        setNewCategoryName('');
    };
    
    const handleSaveEdit = () => {
        if (editingCategory) {
            onUpdateCategory(editingCategory.oldName, editingCategory.newName);
            setEditingCategory(null);
        }
    };
    
    const isCategoryInUse = (categoryName: string) => {
        return menuItems.some(item => item.category === categoryName);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md transform transition-all flex flex-col" style={{maxHeight: '90vh'}} onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b">
                    <h3 className="text-2xl font-bold text-gray-900">จัดการหมวดหมู่</h3>
                </div>
                
                <div className="p-6 space-y-3 overflow-y-auto flex-1">
                    {categories.map(category => (
                        <div key={category} className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-100">
                            {editingCategory?.oldName === category ? (
                                <input
                                    type="text"
                                    value={editingCategory.newName}
                                    onChange={(e) => setEditingCategory({ ...editingCategory, newName: e.target.value })}
                                    className="flex-grow px-2 py-1 border border-gray-300 rounded-md"
                                    autoFocus
                                />
                            ) : (
                                <span className="flex-grow text-gray-800">{category}</span>
                            )}
                            
                            {editingCategory?.oldName === category ? (
                                <div className="flex gap-2">
                                    <button onClick={handleSaveEdit} className="p-2 text-green-600 hover:bg-green-100 rounded-full">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                    </button>
                                    <button onClick={() => setEditingCategory(null)} className="p-2 text-gray-600 hover:bg-gray-200 rounded-full">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                    </button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <button onClick={() => setEditingCategory({ oldName: category, newName: category })} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>
                                    </button>
                                    <button onClick={() => onDeleteCategory(category)} disabled={isCategoryInUse(category)} className="p-2 text-red-600 hover:bg-red-100 rounded-full disabled:text-gray-400 disabled:hover:bg-transparent disabled:cursor-not-allowed" title={isCategoryInUse(category) ? 'ไม่สามารถลบได้ มีเมนูใช้งานอยู่' : 'ลบหมวดหมู่'}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="p-6 border-t bg-gray-50 space-y-2">
                    <h4 className="text-md font-semibold text-gray-800">เพิ่มหมวดหมู่ใหม่</h4>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="เช่น เครื่องดื่มพิเศษ"
                            className="flex-grow px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button onClick={handleAdd} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700">เพิ่ม</button>
                    </div>
                </div>

                <div className="bg-gray-100 px-6 py-4 flex justify-end gap-3 rounded-b-lg border-t">
                    <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-semibold">
                        ปิด
                    </button>
                </div>
            </div>
        </div>
    );
};
