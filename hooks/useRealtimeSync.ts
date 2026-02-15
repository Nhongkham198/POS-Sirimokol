

// FIX: Import React to make types like React.Dispatch and React.SetStateAction available.
import React, { useState, useEffect, useRef } from 'react';
import { mqttService } from '../services/mqttService';

const APP_TOPIC_PREFIX = 'restaurant-pos/v1';

// Custom hook for real-time state synchronization across devices via MQTT, with localStorage fallback.
export function useRealtimeSync<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const isInitialMount = useRef(true);

    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            // If the item exists in localStorage, use it.
            if (item) {
                return JSON.parse(item);
            }
            // If it doesn't exist (first time load), set it in localStorage and then return it.
            // This makes the initial state persistent.
            window.localStorage.setItem(key, JSON.stringify(initialValue));
            return initialValue;
        } catch (error) {
            console.error(`Error reading localStorage key “${key}”:`, error);
            return initialValue;
        }
    });
    
    // The topic for this specific piece of state
    const topic = `${APP_TOPIC_PREFIX}/${key}`;

    const setValue: React.Dispatch<React.SetStateAction<T>> = (value) => {
        try {
            // Allow value to be a function so we have the same API as useState
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            
            // Set state locally immediately for responsiveness
            setStoredValue(valueToStore);
            
            // Save to local storage for persistence and cross-tab sync
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
            
            // Publish the change to other devices via MQTT
            mqttService.publish(topic, valueToStore);

        } catch (error) {
            console.error(`Error setting value for key “${key}”:`, error);
        }
    };
    
    // Effect for handling incoming MQTT messages
    useEffect(() => {
        const handleMessage = (payload: { data: T, senderId: string, timestamp: number }) => {
             // Update local state with the new value from another device
             setStoredValue(payload.data);
             // Also update local storage to keep it in sync
             window.localStorage.setItem(key, JSON.stringify(payload.data));
        };

        const unsubscribe = mqttService.subscribe(topic, handleMessage);

        return () => {
            unsubscribe();
        };
    }, [key, topic]);

    // Effect for handling initial sync and local storage changes from other tabs
    useEffect(() => {
        const handleStorageChange = (event: StorageEvent) => {
            if (event.key === key && event.newValue) {
                try {
                    const newValue = JSON.parse(event.newValue);
                    setStoredValue(newValue);
                    // Also publish this change, as it might have come from a tab that isn't MQTT connected
                    mqttService.publish(topic, newValue);
                } catch (error) {
                    console.error(`Error parsing storage event value for key “${key}”:`, error);
                }
            }
        };

        // On first connection, publish the current state to sync up any new clients.
        if (isInitialMount.current) {
            const statusUnsubscribe = mqttService.addStatusListener((status) => {
                if (status === 'Syncing') {
                    mqttService.publish(topic, storedValue);
                    // No need to listen anymore once we've done the initial publish
                    statusUnsubscribe(); 
                }
            });
            isInitialMount.current = false;
        }
        

        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [key, topic, storedValue]);


    return [storedValue, setValue];
}
