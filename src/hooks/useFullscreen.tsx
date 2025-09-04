import { useEffect, useCallback } from 'react';
import { useFullscreen, useSetFullscreen } from '@/store';

interface FullscreenElement extends Element {
  requestFullscreen(): Promise<void>;
  webkitRequestFullscreen?(): Promise<void>;
}

interface FullscreenDocument extends Document {
  fullscreenElement: FullscreenElement | null;
  webkitFullscreenElement?: FullscreenElement | null;
  exitFullscreen(): Promise<void>;
  webkitExitFullscreen?(): Promise<void>;
}

export function useFullscreenControl() {
  const isFullscreen = useFullscreen();
  const setFullscreen = useSetFullscreen();

  // Kiểm tra browser support
  const isSupported = useCallback(() => {
    const doc = document as FullscreenDocument;
    return !!(
      doc.documentElement.requestFullscreen ||
      (doc.documentElement as any).webkitRequestFullscreen
    );
  }, []);

  // Kiểm tra xem đang fullscreen hay không
  const checkFullscreenState = useCallback(() => {
    const doc = document as FullscreenDocument;
    const isCurrentlyFullscreen = !!(
      doc.fullscreenElement || 
      doc.webkitFullscreenElement
    );
    
    if (isCurrentlyFullscreen !== isFullscreen) {
      setFullscreen(isCurrentlyFullscreen);
    }
  }, [isFullscreen, setFullscreen]);

  // Request fullscreen cho element
  const requestFullscreen = useCallback(async (element: HTMLElement) => {
    if (!isSupported()) {
      console.warn('🔴 Fullscreen API không được hỗ trợ');
      return false;
    }

    try {
      const fullscreenElement = element as FullscreenElement;
      
      if (fullscreenElement.requestFullscreen) {
        await fullscreenElement.requestFullscreen();
      } else if (fullscreenElement.webkitRequestFullscreen) {
        await fullscreenElement.webkitRequestFullscreen();
      }
      
      console.log('✅ Đã vào fullscreen mode');
      return true;
    } catch (error) {
      console.error('🔴 Lỗi khi vào fullscreen:', error);
      return false;
    }
  }, [isSupported]);

  // Exit fullscreen
  const exitFullscreen = useCallback(async () => {
    const doc = document as FullscreenDocument;
    
    try {
      if (doc.exitFullscreen) {
        await doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      }
      
      console.log('✅ Đã thoát fullscreen mode');
      return true;
    } catch (error) {
      console.error('🔴 Lỗi khi thoát fullscreen:', error);
      return false;
    }
  }, []);

  // Toggle fullscreen cho element
  const toggleFullscreen = useCallback(async (element: HTMLElement) => {
    if (isFullscreen) {
      return await exitFullscreen();
    } else {
      return await requestFullscreen(element);
    }
  }, [isFullscreen, requestFullscreen, exitFullscreen]);

  // Listen for fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      checkFullscreenState();
    };

    // Add event listeners cho cả standard và webkit
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    // Initial check
    checkFullscreenState();

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [checkFullscreenState]);

  return {
    isFullscreen,
    isSupported: isSupported(),
    requestFullscreen,
    exitFullscreen,
    toggleFullscreen,
  };
}
