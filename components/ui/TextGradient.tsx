import React from 'react';

interface TextGradientProps {
    text: string;
    className?: string;
}

const TextGradient: React.FC<TextGradientProps> = ({ text, className = '' }) => {
    return (
        <>
            <style>{`
        @keyframes text-gradient-wipe {
          0% { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }
      `}</style>
            <span
                className={`font-sharp ${className}`}
                style={{
                    // Gradient: Purple(Start) -> Purple(Hold) -> Orange(Transition) -> Orange(Hold) -> Purple(Transition) -> Purple(End)
                    background: 'linear-gradient(90deg, #8b5cf6 0%, #8b5cf6 20%, #f97316 45%, #f97316 55%, #8b5cf6 80%, #8b5cf6 100%)',
                    backgroundSize: '300% auto',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    color: 'transparent',
                    animation: 'text-gradient-wipe 6s linear infinite',
                    display: 'inline-block',
                    paddingBottom: '0.1em', // Prevent descender clipping
                    lineHeight: '1.2' // Ensure height for gradient
                }}
            >
                {text}
            </span>
        </>
    );
};

export default TextGradient;
