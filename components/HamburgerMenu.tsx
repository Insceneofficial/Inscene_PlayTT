import React, { useState, useEffect, useRef } from 'react';

interface HamburgerMenuProps {
  children?: React.ReactNode;
}

const HamburgerMenu: React.FC<HamburgerMenuProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close drawer when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        drawerRef.current &&
        !drawerRef.current.contains(event.target as Node) &&
        overlayRef.current &&
        overlayRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Prevent body scroll when drawer is open on mobile
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close drawer on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-xl bg-white/80 backdrop-blur-sm border border-black/[0.08] flex items-center justify-center active:scale-95 hover:bg-white transition-all shadow-sm z-[1001]"
        aria-label="Toggle menu"
        aria-expanded={isOpen}
      >
        <div className="flex flex-col gap-1.5 w-5">
          <span
            className={`h-0.5 bg-[#4A4A4A] rounded-full transition-all duration-300 ${
              isOpen ? 'rotate-45 translate-y-2' : ''
            }`}
          />
          <span
            className={`h-0.5 bg-[#4A4A4A] rounded-full transition-all duration-300 ${
              isOpen ? 'opacity-0' : ''
            }`}
          />
          <span
            className={`h-0.5 bg-[#4A4A4A] rounded-full transition-all duration-300 ${
              isOpen ? '-rotate-45 -translate-y-2' : ''
            }`}
          />
        </div>
      </button>

      {/* Overlay */}
      <div
        ref={overlayRef}
        className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-[1000] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed top-0 left-0 h-full w-[280px] md:w-[320px] bg-white shadow-xl z-[1001] transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          willChange: 'transform',
        }}
      >
        {/* Drawer Content */}
        <div 
          className="overflow-y-auto h-full"
          onClick={(e) => {
            // Close drawer when clicking on buttons inside (but not the close button in child headers)
            const target = e.target as HTMLElement;
            const button = target.closest('button');
            if (button && !button.closest('[data-drawer-header]')) {
              setTimeout(() => setIsOpen(false), 150);
            }
          }}
        >
          {children || (
            <>
              {/* Default Header */}
              <div className="flex items-center justify-between p-6 border-b border-black/[0.06]">
                <h2 className="text-lg font-semibold text-[#1A1A1A] tracking-tight">Menu</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-lg bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center transition-all active:scale-95"
                  aria-label="Close menu"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-4 h-4 text-[#8A8A8A]"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6">
                <p className="text-[#8A8A8A] text-sm">Menu content goes here</p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default HamburgerMenu;
