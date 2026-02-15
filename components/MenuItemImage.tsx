import React, { useState, useEffect, useRef } from 'react';

interface MenuItemImageProps {
    src: string;
    alt: string;
    className?: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export const MenuItemImage: React.FC<MenuItemImageProps> = ({ src, alt, className = '' }) => {
    const [currentSrc, setCurrentSrc] = useState(src);
    const [hasError, setHasError] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const retryCountRef = useRef(0);
    const timeoutIdRef = useRef<number | null>(null);
    const imgRef = useRef<HTMLImageElement>(null); // Ref for the image element

    // Reset everything when the src prop changes
    useEffect(() => {
        setCurrentSrc(src);
        setHasError(false);
        setIsLoaded(false);
        retryCountRef.current = 0;
        if (timeoutIdRef.current) {
            clearTimeout(timeoutIdRef.current);
        }
    }, [src]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (timeoutIdRef.current) {
                clearTimeout(timeoutIdRef.current);
            }
        };
    }, []);

    const handleLoad = () => {
        setIsLoaded(true);
        setHasError(false); // Reset error on successful load
        retryCountRef.current = 0; // Reset on success
    };

    const handleError = () => {
        if (retryCountRef.current < MAX_RETRIES) {
            retryCountRef.current++;
            const delay = RETRY_DELAY_MS * Math.pow(2, retryCountRef.current - 1); // 1s, 2s, 4s
            
            timeoutIdRef.current = window.setTimeout(() => {
                // By changing the src with a cache-busting query parameter, we force a reload.
                setCurrentSrc(`${src}?retry=${retryCountRef.current}`);
            }, delay);

        } else {
            // All retries failed, give up and show the placeholder.
            setHasError(true);
            setIsLoaded(true); // Stop the skeleton loader
        }
    };

    // --- FIX FOR CACHED IMAGES ---
    // This effect checks if the image is already loaded from the browser's cache.
    // The `onLoad` event might not fire for cached images, so this ensures we still
    // update the state correctly.
    useEffect(() => {
        const img = imgRef.current;
        if (img && img.complete && !isLoaded) {
            handleLoad();
        }
    }); // No dependency array, runs after every render to check the image's status.

    // Determine what to render
    const shouldShowImage = src && !hasError;

    return (
        <div className={`${className} relative bg-gray-200 overflow-hidden`}>
            {/* Skeleton Loader - shown until image loads or permanently fails */}
            {!isLoaded && (
                <div className="absolute inset-0 shimmer-effect"></div>
            )}
            
            {shouldShowImage ? (
                <img
                    ref={imgRef}
                    src={currentSrc}
                    alt={alt}
                    className={`w-full h-full object-cover transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                    onLoad={handleLoad}
                    onError={handleError}
                />
            ) : (
                // Placeholder for permanent error or if no src is provided
                <div className={`w-full h-full flex items-center justify-center bg-gray-200 transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-1/2 w-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
            )}
        </div>
    );
};
