
import React from 'react';

interface SalesChartProps {
    data: number[];
    labels: string[];
    images?: string[]; // Add optional images prop
    maxValue: number;
    title: string;
    formatValue?: (value: number) => string;
    onBarClick?: (index: number) => void; // New prop for interaction
    selectedIndex?: number | null; // New prop for highlighting
}

export const SalesChart: React.FC<SalesChartProps> = ({ data, labels, images, maxValue, title, formatValue, onBarClick, selectedIndex }) => {
    // Gradient Palette based on the reference image (Teal -> Greenish -> Lime)
    const gradientColors = [
        '#63C7D4', // Teal
        '#6BCFA6', // Teal-Green
        '#7CD571', // Green
        '#90DB46', // Lime-Green
        '#A4DF37'  // Yellow-Green
    ];

    return (
        <div>
            {title && <h3 className="text-lg font-bold text-gray-800 mb-4">{title}</h3>}
            {/* Container with horizontal scroll support */}
            <div className="w-full border border-gray-200 rounded-lg bg-gray-50 overflow-x-auto">
                {/* Inner container with min-width to ensure bars are not squashed */}
                <div className="h-64 flex items-end gap-1 sm:gap-4 p-4 pt-10 pb-2 min-w-[600px]">
                    {data.map((value, index) => {
                        const isSelected = selectedIndex === index;
                        const isInteractable = !!onBarClick;
                        
                        // Select color: If selected, use Orange. Otherwise, cycle through gradient palette.
                        const barColor = isSelected ? '#f97316' : gradientColors[index % gradientColors.length];
                        
                        return (
                            <div 
                                key={index} 
                                className={`flex-1 h-full flex flex-col items-center justify-end group relative ${isInteractable ? 'cursor-pointer' : ''}`}
                                onClick={() => isInteractable && onBarClick && onBarClick(index)}
                            >
                                {/* Bar */}
                                <div 
                                    className={`w-full rounded-t-md transition-all duration-300 ease-out min-w-[20px] relative ${
                                        isSelected ? 'shadow-md ring-2 ring-orange-300' : 'hover:opacity-90'
                                    }`}
                                    style={{ 
                                        height: `${maxValue > 0 ? (value / maxValue) * 100 : 0}%`,
                                        backgroundColor: barColor
                                    }}
                                >
                                     {/* Value Label - Always Visible if value > 0 */}
                                     {value > 0 && (
                                         <div className="absolute bottom-full mb-1 w-max left-1/2 -translate-x-1/2 z-10">
                                             <span className={`text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded ${isSelected ? 'bg-gray-800 text-white' : 'text-gray-600 bg-white/80 shadow-sm border border-gray-200'}`}>
                                                {formatValue ? formatValue(value) : value.toLocaleString()}
                                             </span>
                                         </div>
                                     )}
                                </div>
                                
                                {/* X-Axis Label (Image + Text) */}
                                <div className="mt-2 flex flex-col items-center justify-start h-16">
                                    {images && images[index] ? (
                                        <div className={`w-8 h-8 rounded-md overflow-hidden border mb-1 shadow-sm flex-shrink-0 ${isSelected ? 'border-orange-500 ring-2 ring-orange-200' : 'border-gray-300 bg-white'}`}>
                                            <img 
                                                src={images[index]} 
                                                alt={labels[index]} 
                                                className="w-full h-full object-cover"
                                                onError={(e) => e.currentTarget.style.display = 'none'}
                                            />
                                        </div>
                                    ) : (
                                        // Placeholder if image is missing but images prop is passed
                                        images && (
                                            <div className="w-8 h-8 rounded-md bg-gray-200 border border-gray-300 mb-1 flex items-center justify-center text-gray-400">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        )
                                    )}
                                    <span className={`text-xs text-center leading-tight line-clamp-2 max-w-[80px] ${isSelected ? 'font-bold text-orange-600' : 'text-gray-600'}`} title={labels[index]}>
                                        {labels[index]}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
