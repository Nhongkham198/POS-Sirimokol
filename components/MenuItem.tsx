
import React from 'react';
import type { MenuItem } from '../types';
import { MenuItemImage } from './MenuItemImage';

interface MenuItemCardProps {
    item: MenuItem;
    onSelectItem: (item: MenuItem) => void;
    isEditMode: boolean;
    onEdit: (item: MenuItem) => void;
    onDelete: (id: number) => void;
    onDragStart?: () => void;
    onDragEnter?: () => void;
    onDragEnd?: () => void;
    isRecommended: boolean;
    onToggleAvailability: () => void;
    onToggleVisibility?: () => void; // New prop for visibility toggle
}

export const MenuItemCard: React.FC<MenuItemCardProps> = ({ 
    item, 
    onSelectItem, 
    isEditMode, 
    onEdit, 
    onDelete, 
    onDragStart, 
    onDragEnter, 
    onDragEnd, 
    isRecommended, 
    onToggleAvailability,
    onToggleVisibility 
}) => {
    // Default to true if undefined
    const isAvailable = item.isAvailable !== false;
    const isVisible = item.isVisible !== false;

    const handleCardClick = () => {
        if (!isEditMode) {
            if (isAvailable) {
                onSelectItem(item);
            }
        }
    };
    
    return (
        <div 
            className={`relative group bg-white rounded-lg shadow-md overflow-hidden flex flex-col border border-gray-200 h-64 
                ${!isEditMode && isAvailable ? 'cursor-pointer hover:shadow-lg hover:border-blue-400 transition-all' : ''} 
                ${isEditMode ? 'cursor-grab' : ''} 
                ${!isAvailable && !isEditMode ? 'grayscale opacity-80 cursor-not-allowed' : ''}
            `}
            onClick={handleCardClick}
            draggable={isEditMode}
            onDragStart={isEditMode ? onDragStart : undefined}
            onDragEnter={isEditMode ? onDragEnter : undefined}
            onDragEnd={isEditMode ? onDragEnd : undefined}
            onDragOver={isEditMode ? (e) => e.preventDefault() : undefined}
        >
            <div className="relative h-36">
                <MenuItemImage 
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-full w-full"
                />
                {!isAvailable && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                        <span className="text-white font-bold text-2xl border-2 border-white px-4 py-1 rounded rotate-[-15deg] uppercase tracking-wider">
                            หมด
                        </span>
                    </div>
                )}
                
                {/* Visual Indicator for Hidden Items (Show in Edit Mode AND POS Mode) */}
                {!isVisible && (
                    <div className="absolute top-0 right-0 bg-gray-800/80 text-white text-[10px] px-2 py-1 rounded-bl-md z-20 backdrop-blur-sm">
                        <span className="flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                                <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                            </svg>
                            {isEditMode ? 'ซ่อนอยู่' : 'เฉพาะ POS'}
                        </span>
                    </div>
                )}
            </div>

            <div className="p-2 flex flex-col flex-auto justify-between">
                <h3 className="font-semibold text-gray-800 text-base leading-tight min-h-[40px] line-clamp-2">{item.name}</h3>
                <div className="flex justify-end items-baseline mt-1 pt-2 border-t border-gray-100">
                     <p className="text-lg font-bold text-blue-600">{item.price.toLocaleString()}<span className="text-sm font-medium"> ฿</span></p>
                </div>
            </div>

            {isRecommended && (
                <div className="absolute top-2 left-2 flex items-center justify-center w-10 h-10 z-20 pointer-events-none" title="เมนูแนะนำ">
                    {/* Anime-like effect: Ping animation behind + Bounce animation on icon */}
                    <div className="absolute w-full h-full bg-red-500/40 rounded-full animate-ping"></div>
                    <div className="relative bg-white rounded-full p-1.5 shadow-lg border-2 border-red-500 flex items-center justify-center animate-bounce">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                        </svg>
                    </div>
                </div>
            )}

            {isEditMode && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 z-30 transition-opacity p-2">
                    
                    {/* Toggle Stock Switch */}
                    <div className="flex items-center justify-between gap-2 bg-white/95 px-3 py-1.5 rounded-full shadow-lg cursor-pointer w-40 hover:bg-white transition-colors border border-gray-200" onClick={(e) => { e.stopPropagation(); onToggleAvailability(); }}>
                        <span className={`text-[10px] font-bold ${isAvailable ? 'text-green-600' : 'text-gray-400'}`}>มีของ</span>
                        <div className={`w-8 h-4 flex items-center rounded-full p-0.5 transition-colors duration-300 ${isAvailable ? 'bg-green-500' : 'bg-red-500'}`}>
                            <div className={`bg-white w-3 h-3 rounded-full shadow-md transform duration-300 ease-in-out ${isAvailable ? 'translate-x-4' : 'translate-x-0'}`}></div>
                        </div>
                        <span className={`text-[10px] font-bold ${!isAvailable ? 'text-red-600' : 'text-gray-400'}`}>หมด</span>
                    </div>

                    {/* Toggle Visibility Switch (NEW) */}
                    {onToggleVisibility && (
                        <div className="flex items-center justify-between gap-2 bg-white/95 px-3 py-1.5 rounded-full shadow-lg cursor-pointer w-40 hover:bg-white transition-colors border border-gray-200" onClick={(e) => { e.stopPropagation(); onToggleVisibility(); }}>
                            <span className={`text-[10px] font-bold ${isVisible ? 'text-blue-600' : 'text-gray-400'}`}>ลูกค้าเห็น</span>
                            <div className={`w-8 h-4 flex items-center rounded-full p-0.5 transition-colors duration-300 ${isVisible ? 'bg-blue-500' : 'bg-gray-400'}`}>
                                <div className={`bg-white w-3 h-3 rounded-full shadow-md transform duration-300 ease-in-out ${isVisible ? 'translate-x-4' : 'translate-x-0'}`}></div>
                            </div>
                            <span className={`text-[10px] font-bold ${!isVisible ? 'text-gray-600' : 'text-gray-400'}`}>ซ่อน</span>
                        </div>
                    )}

                    <div className="flex gap-3 mt-1">
                        <button onClick={(e) => { e.stopPropagation(); onEdit(item); }} className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-200 transition-transform active:scale-95" title="แก้ไขรายละเอียด">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-200 transition-transform active:scale-95" title="ลบเมนู">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
