
import React from 'react';
import type { View, NavItem } from '../types';

interface BottomNavBarProps {
    items: NavItem[];
    currentView: View;
    onViewChange: (view: View) => void;
}

const BottomNavItem: React.FC<{ item: NavItem; isActive: boolean; onClick: () => void; }> = ({ item, isActive, onClick }) => {
    return (
        <button
            onClick={onClick}
            disabled={item.disabled}
            className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors duration-200 h-full w-full ${
                isActive 
                    ? 'bg-gray-700 text-white shadow-inner' 
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
            } ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            <div className="relative w-5 h-5 mb-1">
                {item.icon}
                {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-2 -right-3 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white px-1">
                        {item.badge > 99 ? '99+' : item.badge}
                    </span>
                )}
            </div>
            <span className="text-[10px] font-medium leading-none whitespace-nowrap">{item.label}</span>
        </button>
    );
};


export const BottomNavBar: React.FC<BottomNavBarProps> = ({ items, currentView, onViewChange }) => {
    
    const handleItemClick = (item: NavItem) => {
        if (item.view) {
            onViewChange(item.view);
        } else if (item.onClick) {
            item.onClick();
        }
    };
    
    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-800 p-2 flex overflow-x-auto gap-2 hide-scrollbar md:justify-center">
            {/* Inline style to hide scrollbar for a cleaner look */}
            <style>{`
                .hide-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .hide-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
            {items.map(item => (
                <div key={item.id} className="flex-shrink-0 w-[72px]">
                    <BottomNavItem
                        item={item}
                        isActive={currentView === item.view}
                        onClick={() => handleItemClick(item)}
                    />
                </div>
            ))}
        </nav>
    );
};
