
import React, { useState, useEffect } from 'react';
import { mqttService } from '../services/mqttService';

interface SyncStatusProps {
    onEditConnection: () => void;
}


export const SyncStatus: React.FC<SyncStatusProps> = ({ onEditConnection }) => {
    const [status, setStatus] = useState('Disconnected');

    useEffect(() => {
        const unsubscribe = mqttService.addStatusListener(setStatus);
        // FIX: The cleanup function from useEffect should not return a value.
        // The unsubscribe function returns a boolean, so we wrap it in curly
        // braces to ensure the cleanup function returns void.
        return () => { unsubscribe(); };
    }, []);

    const getStatusIndicator = () => {
        switch (status) {
            case 'Syncing':
                return {
                    indicator: <div className="w-2.5 h-2.5 rounded-full bg-green-500" title="Syncing in real-time"></div>,
                    text: 'Sync'
                };
            case 'Connecting...':
            case 'Reconnecting...':
                return {
                    indicator: <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse" title={status}></div>,
                    text: status
                };
            case 'Error':
            case 'Offline':
            case 'Disconnected':
            default:
                return {
                    indicator: <div className="w-2.5 h-2.5 rounded-full bg-red-500" title={status}></div>,
                    text: status
                };
        }
    };
    
    const { indicator, text } = getStatusIndicator();

    return (
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-100 p-1 pr-2 rounded-full">
            {indicator}
            <span className="hidden sm:inline">{text}</span>
            <button onClick={onEditConnection} className="p-1 rounded-full hover:bg-gray-200" title="Edit Connection Settings">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
            </button>
        </div>
    );
};
