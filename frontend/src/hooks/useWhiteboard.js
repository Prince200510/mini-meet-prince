import { useState, useRef, useCallback } from 'react';

export const useWhiteboard = (sendMessage, roomId, socket) => {
  const canvasRef = useRef(null);
  const [tool, setTool] = useState('pencil');
  const [drawing, setDrawing] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [shapeStart, setShapeStart] = useState(null);
  const [last, setLast] = useState(null);
  const [whiteboardData, setWhiteboardData] = useState([]);  
  const [syncStatus, setSyncStatus] = useState('ready'); 
  const [textInput, setTextInput] = useState({ visible: false, x: 0, y: 0, text: '', fontSize: 16, fontFamily: 'Arial', bold: false, italic: false, underline: false });
  const [previewCanvas, setPreviewCanvas] = useState(null);
  const [toolProperties, setToolProperties] = useState({
    thickness: 3,
    opacity: 1,
    color: '#6366f1',
    fillMode: false, 
    gridSnap: false,
    showGrid: false,
  });
  const [colorPalette, setColorPalette] = useState({
    presetColors: [
      '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
      '#FFA500', '#800080', '#FFC0CB', '#A52A2A', '#808080', '#000080', '#008000', '#800000',
      '#6366f1', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'
    ],
    recentColors: [],
    customColors: []
  });
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selection, setSelection] = useState(null);
  const [clipboard, setClipboard] = useState(null);
  const [layers, setLayers] = useState([
    { id: 'layer1', name: 'Background', visible: true, locked: false, opacity: 1 }
  ]);
  const [activeLayer, setActiveLayer] = useState('layer1');

  const getPos = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let x = (e.clientX - rect.left) * scaleX;
    let y = (e.clientY - rect.top) * scaleY;

    if (toolProperties.gridSnap) {
      const gridSize = 20;
      x = Math.round(x / gridSize) * gridSize;
      y = Math.round(y / gridSize) * gridSize;
    }
    
    return { x, y };
  }, [toolProperties.gridSnap]);

  const drawWithTool = useCallback((a, b, toolType = tool, properties = toolProperties) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.globalAlpha = properties.opacity;
    ctx.strokeStyle = properties.color;
    ctx.fillStyle = properties.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (toolType) {
      case 'pencil':
        ctx.lineWidth = properties.thickness;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        break;
      
      case 'pen':
        ctx.lineWidth = properties.thickness;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        break;

      case 'marker':
        ctx.lineWidth = properties.thickness * 1.5;
        ctx.globalAlpha = properties.opacity * 0.7;
        ctx.lineCap = 'square';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        break;

      case 'highlighter':
        ctx.lineWidth = properties.thickness * 2;
        ctx.globalAlpha = properties.opacity * 0.3;
        ctx.globalCompositeOperation = 'multiply';
        ctx.lineCap = 'square';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        break;

      case 'brush':
        ctx.lineWidth = properties.thickness;
        ctx.globalAlpha = properties.opacity * 0.8;
        const distance = Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
        const steps = Math.max(1, Math.floor(distance / 2));
        for (let i = 0; i <= steps; i++) {
          const x = a.x + (b.x - a.x) * (i / steps);
          const y = a.y + (b.y - a.y) * (i / steps);
          ctx.beginPath();
          ctx.arc(x, y, properties.thickness / 2, 0, 2 * Math.PI);
          ctx.fill();
        }
        break;
    }
    ctx.restore();
  }, [tool, toolProperties]);

  const drawStroke = useCallback((a, b, color = toolProperties.color, toolType = tool) => {
    drawWithTool(a, b, toolType, { ...toolProperties, color });
  }, [drawWithTool, toolProperties, tool]);

  const eraseAt = useCallback((p, radius = 15) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  }, []);

  const drawShape = useCallback((a, b, shape, color = toolProperties.color, filled = toolProperties.fillMode) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.lineWidth = toolProperties.thickness;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.globalAlpha = toolProperties.opacity;

    switch (shape) {
      case 'rectangle':
        if (filled) {
          ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
        } else {
          ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
        }
        break;
      case 'circle':
        const radius = Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
        ctx.beginPath();
        ctx.arc(a.x, a.y, radius, 0, 2 * Math.PI);
        if (filled) {
          ctx.fill();
        } else {
          ctx.stroke();
        }
        break;
      case 'line':
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        break;
      case 'arrow':
        drawArrow(ctx, a, b, color);
        break;
      case 'diamond':
        drawDiamond(ctx, a, b, color, filled);
        break;
      case 'process':
        drawProcess(ctx, a, b, color, filled);
        break;
      case 'oval':
        drawOval(ctx, a, b, color, filled);
        break;
      case 'star':
        drawStar(ctx, a, b, color, filled);
        break;
      case 'polygon':
        drawPolygon(ctx, a, b, color, filled, 6); 
        break;
      case 'heart':
        drawHeart(ctx, a, b, color, filled);
        break;
      case 'speechBubble':
        drawSpeechBubble(ctx, a, b, color, filled);
        break;
      case 'thoughtBubble':
        drawThoughtBubble(ctx, a, b, color, filled);
        break;
    }
    ctx.restore();
  }, [toolProperties]);

  const drawArrow = useCallback((ctx, start, end, color) => {
    const headLength = 15;
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - headLength * Math.cos(angle - Math.PI / 6), 
              end.y - headLength * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - headLength * Math.cos(angle + Math.PI / 6), 
              end.y - headLength * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }, []);

  const drawDiamond = useCallback((ctx, a, b, color, filled) => {
    const centerX = (a.x + b.x) / 2;
    const centerY = (a.y + b.y) / 2;
    const width = Math.abs(b.x - a.x) / 2;
    const height = Math.abs(b.y - a.y) / 2;
    
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(centerX, a.y);
    ctx.lineTo(b.x, centerY);
    ctx.lineTo(centerX, b.y);
    ctx.lineTo(a.x, centerY);
    ctx.closePath();
    
    if (filled) {
      ctx.fill();
    } else {
      ctx.stroke();
    }
  }, []);

  const drawProcess = useCallback((ctx, a, b, color, filled) => {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    
    if (filled) {
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    } else {
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    }
  }, []);

  const drawOval = useCallback((ctx, a, b, color, filled) => {
    const centerX = (a.x + b.x) / 2;
    const centerY = (a.y + b.y) / 2;
    const radiusX = Math.abs(b.x - a.x) / 2;
    const radiusY = Math.abs(b.y - a.y) / 2;
    
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    
    if (filled) {
      ctx.fill();
    } else {
      ctx.stroke();
    }
  }, []);

  const drawStar = useCallback((ctx, a, b, color, filled) => {
    const centerX = (a.x + b.x) / 2;
    const centerY = (a.y + b.y) / 2;
    const outerRadius = Math.min(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / 2;
    const innerRadius = outerRadius * 0.4;
    const points = 5;
    
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / points;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    
    ctx.closePath();
    if (filled) {
      ctx.fill();
    } else {
      ctx.stroke();
    }
  }, []);

  const drawPolygon = useCallback((ctx, a, b, color, filled, sides = 6) => {
    const centerX = (a.x + b.x) / 2;
    const centerY = (a.y + b.y) / 2;
    const radius = Math.min(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / 2;
    
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    
    ctx.closePath();
    if (filled) {
      ctx.fill();
    } else {
      ctx.stroke();
    }
  }, []);

  const drawHeart = useCallback((ctx, a, b, color, filled) => {
    const width = Math.abs(b.x - a.x);
    const height = Math.abs(b.y - a.y);
    const centerX = a.x + width / 2;
    const topY = a.y;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(centerX, topY + height / 4);
    ctx.bezierCurveTo(centerX, topY, centerX - width / 2, topY, centerX - width / 2, topY + height / 4);
    ctx.bezierCurveTo(centerX - width / 2, topY + height / 2, centerX, topY + height / 2, centerX, topY + height);
    ctx.bezierCurveTo(centerX, topY + height / 2, centerX + width / 2, topY + height / 2, centerX + width / 2, topY + height / 4);
    ctx.bezierCurveTo(centerX + width / 2, topY, centerX, topY, centerX, topY + height / 4);
    
    if (filled) {
      ctx.fill();
    } else {
      ctx.stroke();
    }
  }, []);

  const drawSpeechBubble = useCallback((ctx, a, b, color, filled) => {
    const width = Math.abs(b.x - a.x);
    const height = Math.abs(b.y - a.y);
    const radius = 10;
    const tailWidth = 20;
    const tailHeight = 15;
    
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(a.x, a.y, width, height - tailHeight, radius);
    ctx.moveTo(a.x + width * 0.2, a.y + height - tailHeight);
    ctx.lineTo(a.x + width * 0.2 - tailWidth / 2, a.y + height);
    ctx.lineTo(a.x + width * 0.2 + tailWidth / 2, a.y + height - tailHeight);
    
    if (filled) {
      ctx.fill();
    } else {
      ctx.stroke();
    }
  }, []);

  const drawThoughtBubble = useCallback((ctx, a, b, color, filled) => {
    const width = Math.abs(b.x - a.x);
    const height = Math.abs(b.y - a.y);
    const mainRadius = Math.min(width, height - 30) / 2;
    const centerX = a.x + width / 2;
    const centerY = a.y + mainRadius;
    
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, mainRadius, 0, 2 * Math.PI);
    if (filled) ctx.fill();
    else ctx.stroke();
    
    const smallRadius1 = mainRadius * 0.3;
    const smallRadius2 = mainRadius * 0.15;
    
    ctx.beginPath();
    ctx.arc(centerX - mainRadius * 0.6, centerY + mainRadius * 0.8, smallRadius1, 0, 2 * Math.PI);
    if (filled) ctx.fill();
    else ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(centerX - mainRadius * 0.9, centerY + mainRadius * 1.2, smallRadius2, 0, 2 * Math.PI);
    if (filled) ctx.fill();
    else ctx.stroke();
  }, []);

  const drawText = useCallback((x, y, text, textProps = textInput) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.save();
    
    let fontStyle = '';
    if (textProps.bold) fontStyle += 'bold ';
    if (textProps.italic) fontStyle += 'italic ';
    
    ctx.font = `${fontStyle}${textProps.fontSize || 16}px ${textProps.fontFamily || 'Arial'}`;
    ctx.fillStyle = toolProperties.color;
    ctx.textBaseline = 'top';
    ctx.globalAlpha = toolProperties.opacity;
    
    if (textProps.backgroundColor) {
      const metrics = ctx.measureText(text);
      ctx.fillStyle = textProps.backgroundColor;
      ctx.fillRect(x - 2, y - 2, metrics.width + 4, textProps.fontSize + 4);
      ctx.fillStyle = toolProperties.color;
    }
    
    ctx.fillText(text, x, y);
    if (textProps.underline) {
      const metrics = ctx.measureText(text);
      ctx.beginPath();
      ctx.moveTo(x, y + textProps.fontSize + 2);
      ctx.lineTo(x + metrics.width, y + textProps.fontSize + 2);
      ctx.strokeStyle = toolProperties.color;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    
    ctx.restore();
  }, [toolProperties, textInput]);

  const drawGrid = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !toolProperties.showGrid) return;
    
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.5;
    
    const gridSize = 20;
    const width = canvas.width;
    const height = canvas.height;
    
    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    ctx.restore();
  }, [toolProperties.showGrid]);

  const sendWhiteboardMessage = useCallback((message) => {
    console.log('Sending whiteboard message:', message.type);
    if (sendMessage) {
      const sent = sendMessage(message);
      if (sent) {
        console.log('Sent via data channel');
        return;
      }
    }
    if (socket && roomId) {
      console.log('Sending via socket fallback');
      socket.emit('wb-fallback', { room: roomId, ...message });
    }
  }, [sendMessage, socket, roomId]);

  const throttledSendMessage = useCallback((fn, delay = 16) => {
    let timeoutId;
    let lastExecTime = 0;
    return function (...args) {
      const currentTime = Date.now();
      
      if (currentTime - lastExecTime > delay) {
        fn.apply(this, args);
        lastExecTime = currentTime;
      } else {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          fn.apply(this, args);
          lastExecTime = Date.now();
        }, delay - (currentTime - lastExecTime));
      }
    };
  }, []);

  const optimizedDrawStroke = useCallback(throttledSendMessage((a, b, toolType, properties) => {
    drawWithTool(a, b, toolType, properties);
    const strokeData = { type: 'wb', stroke: [a, b], toolType, properties };
    sendWhiteboardMessage(strokeData);
    setWhiteboardData(prev => [...prev, strokeData]);
  }, 16), [drawWithTool, sendWhiteboardMessage, throttledSendMessage]);

  const limitWhiteboardData = useCallback(() => {
    setWhiteboardData(prev => {
      if (prev.length > 1000) { 
        return prev.slice(-800); 
      }
      return prev;
    });
  }, []);

  const optimizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false; 
    
    const devicePixelRatio = window.devicePixelRatio || 1;
    const maxRatio = window.navigator.hardwareConcurrency < 4 ? 1 : Math.min(devicePixelRatio, 2);
    
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * maxRatio;
    canvas.height = rect.height * maxRatio;
    
    ctx.scale(maxRatio, maxRatio);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
  }, []);

  const batchOperations = useCallback((operations) => {
    const canvas = canvasRef.current;
    if (!canvas || !operations.length) return;
    
    const ctx = canvas.getContext('2d');
    ctx.save();
    
    operations.forEach(operation => {
      switch (operation.type) {
        case 'stroke':
          drawWithTool(operation.a, operation.b, operation.toolType, operation.properties);
          break;
        case 'shape':
          drawShape(operation.a, operation.b, operation.shape, operation.color, operation.filled);
          break;
        case 'text':
          drawText(operation.x, operation.y, operation.text, operation.textProps);
          break;
        case 'erase':
          eraseAt({ x: operation.x, y: operation.y }, operation.r);
          break;
      }
    });
    
    ctx.restore();
  }, [drawWithTool, drawShape, drawText, eraseAt]);

  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const imageData = canvas.toDataURL();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(imageData);
    
    if (newHistory.length > 20) {
      newHistory.shift();
    } else {
      setHistoryIndex(prev => prev + 1);
    }
    
    setHistory(newHistory);
  }, [history, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          drawGrid();
        };
        img.src = history[historyIndex - 1];
      }
    }
  }, [historyIndex, history, drawGrid]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          drawGrid();
        };
        img.src = history[historyIndex + 1];
      }
    }
  }, [historyIndex, history, drawGrid]);

  const addToRecentColors = useCallback((color) => {
    setColorPalette(prev => ({
      ...prev,
      recentColors: [color, ...prev.recentColors.filter(c => c !== color)].slice(0, 10)
    }));
  }, []);

  const addCustomColor = useCallback((color) => {
    setColorPalette(prev => ({
      ...prev,
      customColors: [color, ...prev.customColors.filter(c => c !== color)].slice(0, 10)
    }));
  }, []);

  const exportAsImage = useCallback((format = 'png') => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    return canvas.toDataURL(`image/${format}`);
  }, []);

  const saveToLocalStorage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const imageData = canvas.toDataURL();
    const saveData = {
      imageData,
      whiteboardData,
      timestamp: Date.now(),
      toolProperties,
      layers
    };
    
    localStorage.setItem(`whiteboard-${roomId}`, JSON.stringify(saveData));
  }, [whiteboardData, toolProperties, layers, roomId]);

  const loadFromLocalStorage = useCallback(() => {
    try {
      const savedData = localStorage.getItem(`whiteboard-${roomId}`);
      if (savedData) {
        const data = JSON.parse(savedData);
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            drawGrid();
          };
          img.src = data.imageData;
        }
        setWhiteboardData(data.whiteboardData || []);
        if (data.toolProperties) setToolProperties(data.toolProperties);
        if (data.layers) setLayers(data.layers);
        return true;
      }
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
    }
    return false;
  }, [roomId, drawGrid]);

  const handleTextSubmit = useCallback((text) => {
    if (text.trim() && textInput.visible) {
      drawText(textInput.x, textInput.y, text, textInput);
      const textData = { 
        type: 'text', 
        x: textInput.x, 
        y: textInput.y, 
        text, 
        textProps: textInput,
        color: toolProperties.color
      };
      sendWhiteboardMessage(textData);
      setWhiteboardData(prev => [...prev, textData]);
      saveToHistory();
    }
    setTextInput({ visible: false, x: 0, y: 0, text: '', fontSize: 16, fontFamily: 'Arial', bold: false, italic: false, underline: false });
  }, [textInput, drawText, sendWhiteboardMessage, toolProperties.color, saveToHistory]);

  const cancelTextInput = useCallback(() => {
    setTextInput({ visible: false, x: 0, y: 0, text: '', fontSize: 16, fontFamily: 'Arial', bold: false, italic: false, underline: false });
  }, []);

  const handlePointerDown = useCallback((e) => {
    const pos = getPos(e);
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.classList.add('drawing');

    switch (tool) {
      case 'pencil':
      case 'pen':
      case 'marker':
      case 'highlighter':
      case 'brush':
        setDrawing(true);
        setLast(pos);
        saveToHistory();
        break;
      case 'eraser':
        setErasing(true);
        eraseAt(pos);
        sendWhiteboardMessage({ type: 'erase', x: pos.x, y: pos.y, r: toolProperties.thickness });
        setWhiteboardData(prev => [...prev, { type: 'erase', x: pos.x, y: pos.y, r: toolProperties.thickness }]);
        saveToHistory();
        break;
      case 'text':
        setTextInput({ 
          visible: true, 
          x: pos.x, 
          y: pos.y, 
          text: '', 
          fontSize: textInput.fontSize || 16,
          fontFamily: textInput.fontFamily || 'Arial',
          bold: textInput.bold || false,
          italic: textInput.italic || false,
          underline: textInput.underline || false
        });
        break;
      case 'rectangle':
      case 'circle':
      case 'line':
      case 'arrow':
      case 'diamond':
      case 'process':
      case 'oval':
      case 'star':
      case 'polygon':
      case 'heart':
      case 'speechBubble':
      case 'thoughtBubble':
        setDrawing(true);
        setShapeStart(pos);
        saveToHistory();
        break;
    }
  }, [tool, getPos, eraseAt, sendWhiteboardMessage, toolProperties.thickness, textInput, saveToHistory]);

  const handlePointerMove = useCallback((e) => {
    const pos = getPos(e);

    if ((tool === 'pencil' || tool === 'pen' || tool === 'marker' || tool === 'highlighter' || tool === 'brush') && drawing && last) {
      drawWithTool(last, pos, tool, toolProperties);
      const strokeData = { type: 'wb', stroke: [last, pos], toolType: tool, properties: toolProperties };
      sendWhiteboardMessage(strokeData);
      setWhiteboardData(prev => [...prev, strokeData]);
      setLast(pos);
    } else if (tool === 'eraser' && erasing) {
      eraseAt(pos, toolProperties.thickness);
      const eraseData = { type: 'erase', x: pos.x, y: pos.y, r: toolProperties.thickness };
      sendWhiteboardMessage(eraseData);
      setWhiteboardData(prev => [...prev, eraseData]);
    }
  }, [tool, drawing, erasing, last, getPos, drawWithTool, eraseAt, sendWhiteboardMessage, toolProperties]);

  const handlePointerUp = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.classList.remove('drawing');

    if (tool === 'pencil' || tool === 'pen' || tool === 'marker' || tool === 'highlighter' || tool === 'brush') {
      setDrawing(false);
      setLast(null);
    } else if (tool === 'eraser') {
      setErasing(false);
    } else if (['rectangle', 'circle', 'line', 'arrow', 'diamond', 'process', 'oval', 'star', 'polygon', 'heart', 'speechBubble', 'thoughtBubble'].includes(tool) && drawing && shapeStart) {
      const pos = getPos(e);
      drawShape(shapeStart, pos, tool, toolProperties.color, toolProperties.fillMode);
      const shapeData = { 
        type: 'shape', 
        shape: tool, 
        a: shapeStart, 
        b: pos, 
        color: toolProperties.color,
        filled: toolProperties.fillMode,
        properties: toolProperties
      };
      sendWhiteboardMessage(shapeData);
      setWhiteboardData(prev => [...prev, shapeData]);
      setDrawing(false);
      setShapeStart(null);
    }
  }, [tool, drawing, shapeStart, getPos, drawShape, sendWhiteboardMessage, toolProperties]);

  const handlePointerCancel = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.classList.remove('drawing');
    }
    setDrawing(false);
    setErasing(false);
    setLast(null);
    setShapeStart(null);
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    sendWhiteboardMessage({ type: 'clear' });
    setWhiteboardData([]);
    saveToHistory();
  }, [sendWhiteboardMessage, drawGrid, saveToHistory]);

  const restoreWhiteboard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    whiteboardData.forEach(action => {
      switch (action.type) {
        case 'wb':
          if (action.stroke) {
            const [a, b] = action.stroke;
            drawStroke(a, b, '#6366f1');
          }
          break;
        case 'erase':
          eraseAt({ x: action.x, y: action.y }, action.r || 15);
          break;
        case 'shape':
          drawShape(action.a, action.b, action.shape, '#6366f1');
          break;
        case 'text':
          drawText(action.x, action.y, action.text, '#6366f1', action.fontSize || 16);
          break;
      }
    });
  }, [whiteboardData, drawStroke, eraseAt, drawShape]);

  const requestWhiteboardState = useCallback(() => {
    console.log('Requesting whiteboard state from peers');
    setSyncStatus('requesting');
    sendWhiteboardMessage({ type: 'request-state' });
    
    setTimeout(() => {
      setSyncStatus('ready');
    }, 3000);
  }, [sendWhiteboardMessage]);

  const sendWhiteboardState = useCallback(() => {
    console.log('Sending whiteboard state, actions count:', whiteboardData.length);
    if (whiteboardData.length > 0) {
      sendWhiteboardMessage({ 
        type: 'full-state', 
        data: whiteboardData 
      });
    }
  }, [whiteboardData, sendWhiteboardMessage]);

  const applyFullState = useCallback((data) => {
    console.log('Applying full whiteboard state, actions count:', data.length);
    setSyncStatus('syncing');
    setWhiteboardData(data);
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    data.forEach(action => {
      switch (action.type) {
        case 'wb':
          if (action.stroke) {
            const [a, b] = action.stroke;
            drawStroke(a, b, '#6366f1');
          }
          break;
        case 'erase':
          eraseAt({ x: action.x, y: action.y }, action.r || 15);
          break;
        case 'shape':
          drawShape(action.a, action.b, action.shape, '#6366f1');
          break;
        case 'text':
          drawText(action.x, action.y, action.text, '#6366f1', action.fontSize || 16);
          break;
      }
    });
    
    setTimeout(() => setSyncStatus('ready'), 1000);
  }, [drawStroke, eraseAt, drawShape]);

  const handleRemoteMessage = useCallback((message) => {
    console.log('Received whiteboard message:', message.type);
    switch (message.type) {
      case 'wb':
        if (message.stroke) {
          const [a, b] = message.stroke;
          const toolType = message.toolType || 'pen';
          const properties = message.properties || { color: '#ef4444', thickness: 3, opacity: 1 };
          drawWithTool(a, b, toolType, { ...properties, color: '#ef4444' }); 
          setWhiteboardData(prev => [...prev, message]);
        }
        break;
      case 'erase':
        eraseAt({ x: message.x, y: message.y }, message.r || 15);
        setWhiteboardData(prev => [...prev, message]);
        break;
      case 'shape':
        const shapeColor = '#10b981'; 
        const shapeFilled = message.filled || false;
        drawShape(message.a, message.b, message.shape, shapeColor, shapeFilled);
        setWhiteboardData(prev => [...prev, message]);
        break;
      case 'text':
        const textColor = '#f59e0b'; 
        const textProps = message.textProps || { fontSize: 16, fontFamily: 'Arial', bold: false, italic: false, underline: false };
        drawText(message.x, message.y, message.text, { ...textProps, color: textColor });
        setWhiteboardData(prev => [...prev, message]);
        break;
      case 'clear':
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          drawGrid();
        }
        setWhiteboardData([]);
        break;
      case 'request-state':
        console.log('Peer requested whiteboard state');
        sendWhiteboardState();
        break;
      case 'full-state':
        console.log('Received full whiteboard state');
        applyFullState(message.data);
        break;
    }
  }, [drawWithTool, eraseAt, drawShape, drawText, sendWhiteboardState, applyFullState, drawGrid]);

  return {
    canvasRef,
    tool,
    setTool,
    toolProperties,
    setToolProperties,
    colorPalette,
    addToRecentColors,
    addCustomColor,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    clearCanvas,
    drawGrid,
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    textInput,
    setTextInput,
    submitTextInput: handleTextSubmit,
    cancelTextInput,
    handleRemoteMessage,
    requestWhiteboardState,
    syncStatus,
    whiteboardData,
    restoreWhiteboard,
    exportAsImage,
    saveToLocalStorage,
    loadFromLocalStorage,
    layers,
    setLayers,
    activeLayer,
    setActiveLayer,
    selection,
    setSelection,
    clipboard,
    setClipboard,
    optimizeCanvas,
    limitWhiteboardData,
    batchOperations,
    optimizedDrawStroke,
    drawText,
    drawShape,
    drawWithTool,
    eraseAt
  };
};