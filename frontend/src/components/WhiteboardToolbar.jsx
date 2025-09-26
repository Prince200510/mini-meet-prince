import React, { useState } from 'react';
import './WhiteboardToolbar.css';

const WhiteboardToolbar = ({ 
  tool, 
  setTool, 
  toolProperties, 
  setToolProperties, 
  colorPalette, 
  addToRecentColors,
  addCustomColor,
  undo,
  redo,
  canUndo,
  canRedo,
  clearCanvas,
  exportAsImage,
  saveToLocalStorage,
  loadFromLocalStorage,
  textInput,
  setTextInput
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showTextOptions, setShowTextOptions] = useState(false);
  const [customColor, setCustomColor] = useState('#000000');

  const drawingTools = [
    { id: 'pencil', name: 'Pencil', icon: '✏️' },
    { id: 'pen', name: 'Pen', icon: '🖊️' },
    { id: 'marker', name: 'Marker', icon: '🖍️' },
    { id: 'highlighter', name: 'Highlighter', icon: '🖍️' },
    { id: 'brush', name: 'Brush', icon: '🖌️' },
    { id: 'eraser', name: 'Eraser', icon: '🧽' }
  ];

  const shapes = [
    { id: 'line', name: 'Line', icon: '📏' },
    { id: 'rectangle', name: 'Rectangle', icon: '▭' },
    { id: 'circle', name: 'Circle', icon: '○' },
    { id: 'arrow', name: 'Arrow', icon: '➡️' },
    { id: 'star', name: 'Star', icon: '⭐' },
    { id: 'heart', name: 'Heart', icon: '❤️' },
    { id: 'diamond', name: 'Diamond', icon: '♦️' },
    { id: 'polygon', name: 'Polygon', icon: '⬡' },
    { id: 'speechBubble', name: 'Speech Bubble', icon: '💬' },
    { id: 'thoughtBubble', name: 'Thought Bubble', icon: '💭' }
  ];

  const fontFamilies = ['Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Comic Sans MS'];
  const fontSizes = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48];

  const handleColorSelect = (color) => {
    setToolProperties(prev => ({ ...prev, color }));
    addToRecentColors(color);
    setShowColorPicker(false);
  };

  const handleCustomColorAdd = () => {
    addCustomColor(customColor);
    handleColorSelect(customColor);
  };

  const handleExport = (format) => {
    const dataUrl = exportAsImage(format);
    const link = document.createElement('a');
    link.download = `whiteboard.${format}`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div className="whiteboard-toolbar bg-white shadow-lg rounded-lg p-4 flex flex-wrap gap-4 items-center">
      <div className="toolbar-group">
        <h3 className="text-sm font-semibold text-gray-600 mb-2">Drawing Tools</h3>
        <div className="flex gap-2">
          {drawingTools.map(drawTool => (
            <button
              key={drawTool.id}
              onClick={() => setTool(drawTool.id)}
              className={`p-2 rounded border ${
                tool === drawTool.id ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
              title={drawTool.name}
            >
              {drawTool.icon}
            </button>
          ))}
          <button
            onClick={() => setTool('text')}
            className={`p-2 rounded border ${
              tool === 'text' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
            title="Text"
          >
            📝
          </button>
        </div>
      </div>

      <div className="toolbar-group">
        <h3 className="text-sm font-semibold text-gray-600 mb-2">Shapes</h3>
        <div className="flex gap-2 flex-wrap">
          {shapes.map(shape => (
            <button
              key={shape.id}
              onClick={() => setTool(shape.id)}
              className={`p-2 rounded border ${
                tool === shape.id ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
              title={shape.name}
            >
              {shape.icon}
            </button>
          ))}
        </div>
      </div>
      <div className="toolbar-group">
        <h3 className="text-sm font-semibold text-gray-600 mb-2">Properties</h3>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-1">
            <label className="text-xs">Size:</label>
            <input
              type="range"
              min="1"
              max="20"
              value={toolProperties.thickness}
              onChange={(e) => setToolProperties(prev => ({ ...prev, thickness: parseInt(e.target.value) }))}
              className="w-16"
            />
            <span className="text-xs w-6">{toolProperties.thickness}</span>
          </div>

          <div className="flex items-center gap-1">
            <label className="text-xs">Opacity:</label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={toolProperties.opacity}
              onChange={(e) => setToolProperties(prev => ({ ...prev, opacity: parseFloat(e.target.value) }))}
              className="w-16"
            />
            <span className="text-xs w-8">{Math.round(toolProperties.opacity * 100)}%</span>
          </div>

          {shapes.some(s => s.id === tool) && (
            <button
              onClick={() => setToolProperties(prev => ({ ...prev, fillMode: !prev.fillMode }))}
              className={`p-1 rounded border text-xs ${
                toolProperties.fillMode ? 'bg-blue-500 text-white' : 'bg-gray-100'
              }`}
            >
              {toolProperties.fillMode ? 'Filled' : 'Outline'}
            </button>
          )}
        </div>
      </div>
      <div className="toolbar-group">
        <h3 className="text-sm font-semibold text-gray-600 mb-2">Colors</h3>
        <div className="relative">
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="w-8 h-8 border-2 border-gray-300 rounded"
            style={{ backgroundColor: toolProperties.color }}
            title="Select Color"
          />
          
          {showColorPicker && (
            <div className="absolute top-10 left-0 bg-white border rounded shadow-lg p-3 z-10">
              <div className="mb-3">
                <h4 className="text-xs font-semibold mb-2">Preset Colors</h4>
                <div className="grid grid-cols-8 gap-1">
                  {colorPalette.presetColors.map((color, index) => (
                    <button
                      key={index}
                      onClick={() => handleColorSelect(color)}
                      className="w-6 h-6 border border-gray-200 rounded"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {colorPalette.recentColors.length > 0 && (
                <div className="mb-3">
                  <h4 className="text-xs font-semibold mb-2">Recent Colors</h4>
                  <div className="flex gap-1">
                    {colorPalette.recentColors.slice(0, 8).map((color, index) => (
                      <button
                        key={index}
                        onClick={() => handleColorSelect(color)}
                        className="w-6 h-6 border border-gray-200 rounded"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs font-semibold mb-2">Custom Color</h4>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="w-12 h-6"
                  />
                  <button
                    onClick={handleCustomColorAdd}
                    className="px-2 py-1 text-xs bg-blue-500 text-white rounded"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {tool === 'text' && (
        <div className="toolbar-group">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Text Options</h3>
          <div className="flex gap-2 items-center">
            <select
              value={textInput.fontFamily}
              onChange={(e) => setTextInput(prev => ({ ...prev, fontFamily: e.target.value }))}
              className="text-xs border rounded px-1"
            >
              {fontFamilies.map(font => (
                <option key={font} value={font}>{font}</option>
              ))}
            </select>
            
            <select
              value={textInput.fontSize}
              onChange={(e) => setTextInput(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
              className="text-xs border rounded px-1"
            >
              {fontSizes.map(size => (
                <option key={size} value={size}>{size}px</option>
              ))}
            </select>

            <button
              onClick={() => setTextInput(prev => ({ ...prev, bold: !prev.bold }))}
              className={`px-2 py-1 text-xs border rounded font-bold ${
                textInput.bold ? 'bg-blue-500 text-white' : 'bg-gray-100'
              }`}
            >
              B
            </button>

            <button
              onClick={() => setTextInput(prev => ({ ...prev, italic: !prev.italic }))}
              className={`px-2 py-1 text-xs border rounded italic ${
                textInput.italic ? 'bg-blue-500 text-white' : 'bg-gray-100'
              }`}
            >
              I
            </button>

            <button
              onClick={() => setTextInput(prev => ({ ...prev, underline: !prev.underline }))}
              className={`px-2 py-1 text-xs border rounded underline ${
                textInput.underline ? 'bg-blue-500 text-white' : 'bg-gray-100'
              }`}
            >
              U
            </button>
          </div>
        </div>
      )}

      <div className="toolbar-group">
        <h3 className="text-sm font-semibold text-gray-600 mb-2">Grid</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setToolProperties(prev => ({ ...prev, showGrid: !prev.showGrid }))}
            className={`px-2 py-1 text-xs border rounded ${
              toolProperties.showGrid ? 'bg-blue-500 text-white' : 'bg-gray-100'
            }`}
          >
            Show Grid
          </button>
          <button
            onClick={() => setToolProperties(prev => ({ ...prev, gridSnap: !prev.gridSnap }))}
            className={`px-2 py-1 text-xs border rounded ${
              toolProperties.gridSnap ? 'bg-blue-500 text-white' : 'bg-gray-100'
            }`}
          >
            Snap to Grid
          </button>
        </div>
      </div>
      <div className="toolbar-group">
        <h3 className="text-sm font-semibold text-gray-600 mb-2">Actions</h3>
        <div className="flex gap-2">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="px-3 py-1 text-xs border rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
            title="Undo"
          >
            ↶
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="px-3 py-1 text-xs border rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
            title="Redo"
          >
            ↷
          </button>
          <button
            onClick={clearCanvas}
            className="px-3 py-1 text-xs border rounded bg-red-100 hover:bg-red-200 text-red-700"
            title="Clear All"
          >
            🗑️
          </button>
        </div>
      </div>

      <div className="toolbar-group">
        <h3 className="text-sm font-semibold text-gray-600 mb-2">File</h3>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('png')}
            className="px-2 py-1 text-xs border rounded bg-green-100 hover:bg-green-200"
            title="Export as PNG"
          >
            📥 PNG
          </button>
          <button
            onClick={() => handleExport('jpg')}
            className="px-2 py-1 text-xs border rounded bg-green-100 hover:bg-green-200"
            title="Export as JPG"
          >
            📥 JPG
          </button>
          <button
            onClick={saveToLocalStorage}
            className="px-2 py-1 text-xs border rounded bg-blue-100 hover:bg-blue-200"
            title="Save to Local Storage"
          >
            💾
          </button>
          <button
            onClick={loadFromLocalStorage}
            className="px-2 py-1 text-xs border rounded bg-blue-100 hover:bg-blue-200"
            title="Load from Local Storage"
          >
            📂
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhiteboardToolbar;