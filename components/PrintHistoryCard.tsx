import React, { useState, useMemo } from 'react';
import type { PrintHistoryEntry } from '../types';

interface PrintHistoryCardProps {
    entry: PrintHistoryEntry;
    isEditMode: boolean;
    isSelected: boolean;
    onToggleSelection: (entryId: number) => void;
    onReprint: (orderNumber: number) => void;
}

export const PrintHistoryCard: React.FC<PrintHistoryCardProps> = ({ entry, isEditMode, isSelected, onToggleSelection, onReprint }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const timestamp = useMemo(() => new Date(entry.timestamp).toLocaleString('th-TH'), [entry.timestamp]);
    
    const cardClasses = useMemo(() => {
        if (entry.isDeleted) {
            return "bg-red-50/50 rounded-lg shadow-md border border-red-200 overflow-hidden transition-colors opacity-70";
        }
        let base = "bg-white rounded-lg shadow-md border overflow-hidden transition-colors ";
        if (isEditMode && isSelected) {
            base += "border-blue-400 bg-blue-50 ring-2 ring-blue-300";
        } else {
            base += "border-gray-200";
        }
        return base;
    }, [isEditMode, isSelected, entry.isDeleted]);

    const statusIcon = entry.status === 'success'
        ? <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
        : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>;

    return (
        <div className={cardClasses}>
            <header className={`p-4 flex justify-between items-center ${entry.isDeleted ? 'bg-red-100/60' : 'bg-gray-50'}`} >
                <div className="flex items-center gap-4 flex-1">
                    {isEditMode && (
                        <div className="p-2 flex-shrink-0">
                             <input type="checkbox" checked={isSelected} onChange={() => onToggleSelection(entry.id)} className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                        </div>
                    )}
                    <div className="flex-1 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                        <div className="flex items-baseline gap-2 flex-wrap">
                            <p className={`font-bold text-xl ${entry.isDeleted ? 'text-red-700' : 'text-blue-700'}`}>
                                <span className={entry.isDeleted ? 'text-red-400' : 'text-gray-500'}>#</span>{String(entry.orderNumber).padStart(3, '0')}
                            </p>
                            <p className={`font-semibold text-lg truncate ${entry.isDeleted ? 'text-red-800' : 'text-gray-800'}`}>โต๊ะ {entry.tableName}</p>
                            {entry.isReprint && !entry.isDeleted && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-semibold">พิมพ์ซ้ำ</span>}
                            {entry.isDeleted && <span className="text-xs px-2 py-0.5 rounded-full bg-red-200 text-red-800 font-semibold">(ลบโดย: {entry.deletedBy})</span>}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{timestamp} โดย {entry.printedBy}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                    <div className="flex items-center gap-1 text-sm font-semibold">
                        {statusIcon}
                        <span className={entry.status === 'success' ? 'text-green-700' : 'text-red-700'}>
                            {entry.status === 'success' ? 'สำเร็จ' : 'ล้มเหลว'}
                        </span>
                    </div>
                    <svg className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </div>
            </header>

            {isExpanded && (
                <div className={`p-4 border-t ${entry.isDeleted ? 'text-gray-500' : ''}`}>
                    <div className="space-y-2">
                        <h4 className="font-semibold text-gray-700 mb-2">รายการที่พิมพ์</h4>
                        <ul className="list-disc list-inside text-sm text-gray-600 pl-2 space-y-1">
                           {entry.orderItemsPreview.map((item, index) => <li key={index}>{item}</li>)}
                        </ul>
                    </div>
                    {entry.errorMessage && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
                            <strong>ข้อผิดพลาด:</strong> {entry.errorMessage}
                        </div>
                    )}
                    <div className="mt-4 pt-4 border-t flex justify-end">
                        <button onClick={() => onReprint(entry.orderNumber)} className="px-4 py-2 bg-blue-100 text-blue-800 text-base font-semibold rounded-md hover:bg-blue-200 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed" disabled={entry.isDeleted}>
                            พิมพ์อีกครั้ง
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};