
import React, { useState, useMemo, useEffect } from 'react';
import type { MenuItem } from '../types';
import { MenuItemImage } from './MenuItemImage';
import { ThaiVirtualKeyboard } from './ThaiVirtualKeyboard';

interface MenuSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    menuItems: MenuItem[];
    onSelectItem: (item: MenuItem) => void;
    onToggleAvailability: (id: number) => void;
}

export const MenuSearchModal: React.FC<MenuSearchModalProps> = ({ isOpen, onClose, menuItems, onSelectItem, onToggleAvailability }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isStockMode, setIsStockMode] = useState(false);
    const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setIsKeyboardOpen(false);
        }
    }, [isOpen]);

    const filteredItems = useMemo(() => {
        if (!searchTerm.trim()) {
            return menuItems;
        }
        // Improved Search: Split terms by whitespace and check if all terms exist in name
        const searchParts = searchTerm.toLowerCase().trim().split(/\s+/);
        return menuItems.filter(item =>
            searchParts.every(part => item.name.toLowerCase().includes(part))
        );
    }, [searchTerm, menuItems]);

    const handleItemClick = (item: MenuItem) => {
        if (isStockMode) {
            onToggleAvailability(item.id);
        } else {
            if (item.isAvailable !== false) {
                onSelectItem(item);
                // Do not call onClose() here. The onSelectItem handler will handle state transitions.
            }
        }
    };

    // --- Virtual Keyboard Handlers ---
    const handleVirtualKeyPress = (key: string) => {
        setSearchTerm(prev => prev + key);
    };

    const handleVirtualBackspace = () => {
        setSearchTerm(prev => prev.slice(0, -1));
    };

    const handleVirtualClear = () => {
        setSearchTerm('');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg transform transition-all flex flex-col relative" style={{maxHeight: '90vh'}} onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-2xl font-bold text-gray-900 flex items-center">
                            ค้นหาเมนูอาหาร
                            {filteredItems.length > 0 && (
                                <span className="ml-3 px-3 py-1 bg-blue-100 text-blue-700 text-lg rounded-full font-bold shadow-sm">
                                    {filteredItems.length}
                                </span>
                            )}
                        </h3>
                        <button
                            onClick={() => setIsStockMode(!isStockMode)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors ${
                                isStockMode 
                                    ? 'bg-red-50 text-white border-red-600 shadow-inner' 
                                    : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                            }`}
                        >
                            {isStockMode ? 'เสร็จสิ้น' : 'จัดการของหมด'}
                        </button>
                    </div>
                     <div className="relative">
                         <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                            <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </span>
                        <input
                            type="text"
                            placeholder="พิมพ์ชื่อเมนู..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                            autoFocus
                        />
                        <button 
                            className={`absolute inset-y-0 right-0 flex items-center pr-3 transition-colors ${isKeyboardOpen ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}
                            onClick={() => {
                                if (!isKeyboardOpen) {
                                    setSearchTerm(''); // Clear text when opening keyboard
                                }
                                setIsKeyboardOpen(!isKeyboardOpen);
                            }}
                            title={isKeyboardOpen ? "ปิดแป้นพิมพ์" : "เปิดแป้นพิมพ์ไทย"}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Added dynamic padding-bottom (pb-96) when keyboard is open to allow scrolling past the keyboard */}
                <div className={`p-6 space-y-2 overflow-y-auto flex-1 ${isKeyboardOpen ? 'pb-96' : ''}`}>
                    {filteredItems.length > 0 ? (
                        filteredItems.map(item => {
                            const isAvailable = item.isAvailable !== false;
                            
                            return (
                                <div
                                    key={item.id}
                                    onClick={() => handleItemClick(item)}
                                    className={`flex items-center gap-4 p-3 rounded-lg border transition-all cursor-pointer ${
                                        !isAvailable 
                                            ? 'bg-red-50 border-red-200 opacity-90' 
                                            : 'hover:bg-gray-100 border-transparent'
                                    }`}
                                >
                                    <div className="relative">
                                        <MenuItemImage src={item.imageUrl} alt={item.name} className={`w-16 h-16 rounded-md object-cover flex-shrink-0 ${!isAvailable ? 'grayscale' : ''}`} />
                                        {!isAvailable && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-md">
                                                <span className="text-white text-xs font-bold bg-red-600 px-1 rounded">หมด</span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="flex-1">
                                        <p className={`font-semibold ${!isAvailable ? 'text-gray-500' : 'text-gray-800'}`}>{item.name}</p>
                                        <p className="text-sm text-gray-500">{item.category}</p>
                                    </div>
                                    
                                    {isStockMode ? (
                                        <div className={`w-12 h-6 rounded-full p-1 transition-colors ${isAvailable ? 'bg-green-500' : 'bg-red-500'}`}>
                                            <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${isAvailable ? 'translate-x-6' : 'translate-x-0'}`} />
                                        </div>
                                    ) : (
                                        <p className={`font-bold text-lg ${!isAvailable ? 'text-gray-400' : 'text-blue-600'}`}>{item.price.toLocaleString()} ฿</p>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <p className="text-center text-gray-500 py-8">ไม่พบเมนูที่ตรงกัน</p>
                    )}
                </div>

                <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 rounded-b-lg border-t">
                    <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-semibold">
                        ปิด
                    </button>
                </div>

                {/* Virtual Keyboard Overlay */}
                {isKeyboardOpen && (
                    <ThaiVirtualKeyboard 
                        onKeyPress={handleVirtualKeyPress}
                        onBackspace={handleVirtualBackspace}
                        onClear={handleVirtualClear}
                        onClose={() => setIsKeyboardOpen(false)}
                    />
                )}
            </div>
        </div>
    );
};
