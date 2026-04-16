/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Upload,
  Image,
  X,
  Plus, 
  Trash2, 
  Maximize2, 
  Layers, 
  Info, 
  Download,
  Box,
  Circle,
  Square,
  Layout,
  ChevronRight,
  Settings2,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react';
import { PrintZone, BagSpecs } from './types';
import { INITIAL_BAG_SPECS, INITIAL_ZONES } from './constants';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
  });
};

const DimensionLine = ({ 
  length, 
  orientation, 
  label, 
  position = 'start',
  className = ""
}: { 
  length: number; 
  orientation: 'horizontal' | 'vertical'; 
  label: string;
  position?: 'start' | 'end';
  className?: string;
}) => {
  const isHorizontal = orientation === 'horizontal';
  
  return (
    <div 
      className={`absolute flex items-center justify-center pointer-events-none ${isHorizontal ? 'flex-col' : 'flex-row'} ${className}`}
      style={{
        width: isHorizontal ? length : 20,
        height: isHorizontal ? 20 : length,
      }}
    >
      <div className={`bg-red-500/60 ${isHorizontal ? 'w-full h-[1px]' : 'w-[1px] h-full'} relative`}>
        {/* Arrows */}
        <div className={`absolute ${isHorizontal ? 'left-0 -top-[3px] border-r-[6px] border-y-[4px] border-y-transparent border-r-red-500/60' : 'top-0 -left-[3px] border-b-[6px] border-x-[4px] border-x-transparent border-b-red-500/60'}`} />
        <div className={`absolute ${isHorizontal ? 'right-0 -top-[3px] border-l-[6px] border-y-[4px] border-y-transparent border-l-red-500/60' : 'bottom-0 -left-[3px] border-t-[6px] border-x-[4px] border-x-transparent border-t-red-500/60'}`} />
      </div>
      <span className={`absolute font-mono text-[11px] font-bold text-red-600 bg-white px-1.5 py-0.5 rounded-sm whitespace-nowrap shadow-md border border-red-500/40 z-10 ${isHorizontal ? '-top-2' : 'left-3'}`}>
        {label}
      </span>
    </div>
  );
};

export default function App() {
  const [specs, setSpecs] = useState<BagSpecs>(INITIAL_BAG_SPECS);
  const [zones, setZones] = useState<PrintZone[]>(INITIAL_ZONES);
  const [activeSide, setActiveSide] = useState<'front' | 'reverse'>('front');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [zoom, setZoom] = useState(1.5);

  const totalArea = useMemo(() => specs.width * specs.height, [specs]);

  const calculations = useMemo(() => {
    const frontArea = zones
      .filter(z => z.side === 'front')
      .reduce((acc, z) => acc + (z.type === 'rectangle' ? z.width * z.height : Math.PI * Math.pow(z.width / 2, 2)), 0);
    
    const reverseArea = zones
      .filter(z => z.side === 'reverse')
      .reduce((acc, z) => acc + (z.type === 'rectangle' ? z.width * z.height : Math.PI * Math.pow(z.width / 2, 2)), 0);

    const totalPrinted = frontArea + reverseArea;
    const frontCoverage = (frontArea / totalArea) * 100;
    const reverseCoverage = (reverseArea / totalArea) * 100;
    const coverage = (totalPrinted / (totalArea * 2)) * 100;

    return {
      frontArea,
      reverseArea,
      totalPrinted,
      frontCoverage,
      reverseCoverage,
      coverage
    };
  }, [zones, totalArea]);

  const addZone = () => {
    const newZone: PrintZone = {
      id: Math.random().toString(36).substr(2, 9),
      name: `New Zone ${zones.length + 1}`,
      type: 'rectangle',
      width: 50,
      height: 50,
      x: 0,
      y: 0,
      side: activeSide,
      color: activeSide === 'front' ? '#004B6D' : '#008B7D'
    };
    setZones([...zones, newZone]);
  };

  const removeZone = (id: string) => {
    setZones(zones.filter(z => z.id !== id));
  };

  const updateZone = (id: string, updates: Partial<PrintZone>) => {
    setZones(zones.map(z => z.id === id ? { ...z, ...updates } : z));
  };

  const handleArtworkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const isPdf = file.type === 'application/pdf';
    
    setSpecs(prev => ({
      ...prev,
      artworkUrl: url,
      isPdf: isPdf
    }));

    setIsAnalyzing(true);
    try {
      const base64 = await fileToBase64(file);
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [
          {
            parts: [
              {
                inlineData: {
                  data: base64,
                  mimeType: file.type,
                },
              },
              {
                text: "Analyze this packaging artwork. Extract the overall bag dimensions (width and height in mm) and all distinct print zones (logos, text blocks, colored panels). For each print zone, provide its name, type (rectangle or circle), width, height, x position, y position, and which side it's on (front or reverse). Assume the origin (0,0) is at the top-left of the bag for each side. Return the data in the specified JSON format.",
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              width: { type: Type.NUMBER, description: "Overall bag width in mm" },
              height: { type: Type.NUMBER, description: "Overall bag height in mm" },
              zones: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ["rectangle", "circle"] },
                    width: { type: Type.NUMBER },
                    height: { type: Type.NUMBER },
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                    side: { type: Type.STRING, enum: ["front", "reverse"] },
                    color: { type: Type.STRING, description: "Hex color code if applicable" }
                  },
                  required: ["name", "type", "width", "height", "x", "y", "side"]
                }
              }
            },
            required: ["width", "height", "zones"]
          }
        }
      });

      const data = JSON.parse(response.text);
      setSpecs(prev => ({ ...prev, width: data.width, height: data.height }));
      setZones(data.zones.map((z: any) => ({
        ...z,
        id: Math.random().toString(36).substr(2, 9)
      })));
    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const removeArtwork = () => {
    setSpecs(prev => ({
      ...prev,
      artworkUrl: undefined,
      isPdf: undefined
    }));
  };

  return (
    <div className="min-h-screen bg-bg text-ink selection:bg-ink selection:text-bg">
      {/* Header */}
      <header className="border-b border-line p-6 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-mono tracking-tighter uppercase leading-none">PrintCalc</h1>
          <p className="font-serif italic text-xs opacity-50 mt-1">Technical Printing Coverage Analysis v1.0</p>
        </div>
        <div className="flex gap-4">
          <button className="flex items-center gap-2 px-4 py-2 border border-line hover:bg-ink hover:text-bg transition-colors font-mono text-xs uppercase">
            <Download size={14} />
            Export Report
          </button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-[400px_1fr] h-[calc(100vh-100px)]">
        {/* Sidebar Controls */}
        <aside className="border-r border-line overflow-y-auto bg-white/50 backdrop-blur-sm">
          {/* Bag Specs */}
          <section className="p-6 border-b border-line">
            <div className="flex items-center gap-2 mb-4">
              <Settings2 size={16} className="opacity-50" />
              <h2 className="col-header">Bag Specifications</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-mono text-[10px] uppercase opacity-50 block mb-1">Width</label>
                <input 
                  type="number" 
                  value={specs.width}
                  onChange={(e) => setSpecs({ ...specs, width: Number(e.target.value) })}
                  className="w-full bg-transparent border-b border-line py-1 font-mono text-lg focus:outline-none focus:border-ink transition-colors"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] uppercase opacity-50 block mb-1">Height</label>
                <input 
                  type="number" 
                  value={specs.height}
                  onChange={(e) => setSpecs({ ...specs, height: Number(e.target.value) })}
                  className="w-full bg-transparent border-b border-line py-1 font-mono text-lg focus:outline-none focus:border-ink transition-colors"
                />
              </div>
            </div>
            <div className="mt-4 space-y-4">
              <label className="font-mono text-[10px] uppercase opacity-50 block mb-1">Unit</label>
              <div className="flex gap-2">
                {(['mm', 'cm', 'in'] as const).map((u) => (
                  <button
                    key={u}
                    onClick={() => setSpecs({ ...specs, unit: u })}
                    className={`flex-1 py-1 border border-line font-mono text-[10px] uppercase transition-colors ${specs.unit === u ? 'bg-ink text-bg' : 'hover:bg-ink/10'}`}
                  >
                    {u}
                  </button>
                ))}
              </div>

              <div className="space-y-3 pt-4 border-t border-line/10">
                <label className="font-mono text-[10px] uppercase opacity-50 block">Reference Artwork</label>
                <div className="relative">
                  <input
                    type="file"
                    id="artwork-upload"
                    className="hidden"
                    accept="image/*,.pdf"
                    onChange={handleArtworkUpload}
                    disabled={isAnalyzing}
                  />
                  <label
                    htmlFor="artwork-upload"
                    className={`flex flex-col items-center justify-center gap-2 p-6 border border-dashed border-line/30 rounded-sm cursor-pointer hover:bg-ink/5 transition-colors ${specs.artworkUrl ? 'bg-ink/5' : ''} ${isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 size={24} className="animate-spin text-ink/50" />
                        <span className="font-mono text-[10px] uppercase">Analyzing Artwork...</span>
                      </>
                    ) : specs.artworkUrl ? (
                      <>
                        <Image size={24} className="text-ink/50" />
                        <span className="font-mono text-[10px] uppercase">Artwork Uploaded</span>
                        <span className="font-serif italic text-[9px] opacity-40">Click to replace</span>
                      </>
                    ) : (
                      <>
                        <Upload size={24} className="text-ink/30" />
                        <span className="font-mono text-[10px] uppercase">Upload Reference Artwork</span>
                        <span className="font-serif italic text-[9px] opacity-40">PDF or Photo</span>
                      </>
                    )}
                  </label>
                  {specs.artworkUrl && !isAnalyzing && (
                    <button
                      onClick={removeArtwork}
                      className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-sm"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Zones List */}
          <section className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <Layers size={16} className="opacity-50" />
                <h2 className="col-header">Print Zones</h2>
              </div>
              <button 
                onClick={addZone}
                className="p-1 border border-line hover:bg-ink hover:text-bg transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="flex gap-2 mb-6 p-1 border border-line rounded-sm">
              <button 
                onClick={() => setActiveSide('front')}
                className={`flex-1 py-1 font-mono text-[10px] uppercase transition-colors ${activeSide === 'front' ? 'bg-ink text-bg' : 'hover:bg-ink/10'}`}
              >
                Front
              </button>
              <button 
                onClick={() => setActiveSide('reverse')}
                className={`flex-1 py-1 font-mono text-[10px] uppercase transition-colors ${activeSide === 'reverse' ? 'bg-ink text-bg' : 'hover:bg-ink/10'}`}
              >
                Reverse
              </button>
            </div>

            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {zones.filter(z => z.side === activeSide).map((zone) => (
                  <motion.div 
                    key={zone.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-4 border border-line bg-white group"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <input 
                        value={zone.name}
                        onChange={(e) => updateZone(zone.id, { name: e.target.value })}
                        className="font-serif italic text-sm bg-transparent focus:outline-none w-full"
                      />
                      <button 
                        onClick={() => removeZone(zone.id)}
                        className="opacity-0 group-hover:opacity-50 hover:opacity-100 transition-opacity text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="font-mono text-[9px] uppercase opacity-50 block">Width</label>
                        <input 
                          type="number" 
                          value={zone.width}
                          onChange={(e) => updateZone(zone.id, { width: Number(e.target.value) })}
                          className="w-full bg-transparent border-b border-line/30 py-1 font-mono text-sm focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="font-mono text-[9px] uppercase opacity-50 block">Height</label>
                        <input 
                          type="number" 
                          value={zone.height}
                          onChange={(e) => updateZone(zone.id, { height: Number(e.target.value) })}
                          className="w-full bg-transparent border-b border-line/30 py-1 font-mono text-sm focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="font-mono text-[9px] uppercase opacity-50 block">X Pos</label>
                        <input 
                          type="number" 
                          value={zone.x}
                          onChange={(e) => updateZone(zone.id, { x: Number(e.target.value) })}
                          className="w-full bg-transparent border-b border-line/30 py-1 font-mono text-sm focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="font-mono text-[9px] uppercase opacity-50 block">Y Pos</label>
                        <input 
                          type="number" 
                          value={zone.y}
                          onChange={(e) => updateZone(zone.id, { y: Number(e.target.value) })}
                          className="w-full bg-transparent border-b border-line/30 py-1 font-mono text-sm focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => updateZone(zone.id, { type: 'rectangle' })}
                        className={`p-1 border border-line transition-colors ${zone.type === 'rectangle' ? 'bg-ink text-bg' : 'hover:bg-ink/10'}`}
                      >
                        <Square size={12} />
                      </button>
                      <button 
                        onClick={() => updateZone(zone.id, { type: 'circle' })}
                        className={`p-1 border border-line transition-colors ${zone.type === 'circle' ? 'bg-ink text-bg' : 'hover:bg-ink/10'}`}
                      >
                        <Circle size={12} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </section>

          {/* Summary Table */}
          <section className="p-6 border-t border-line bg-ink text-bg">
            <h2 className="col-header text-bg/50 mb-4">Summary Breakdown</h2>
            <div className="space-y-2">
              <div className="flex justify-between font-mono text-[10px] uppercase opacity-50">
                <span>Front Total</span>
                <span>{calculations.frontArea.toFixed(1)} {specs.unit}²</span>
              </div>
              <div className="flex justify-between font-mono text-[10px] uppercase opacity-50">
                <span>Reverse Total</span>
                <span>{calculations.reverseArea.toFixed(1)} {specs.unit}²</span>
              </div>
              <div className="h-px bg-bg/20 my-2" />
              <div className="flex justify-between font-mono text-xs uppercase">
                <span>Total Ink</span>
                <span className="text-white">{calculations.totalPrinted.toFixed(1)} {specs.unit}²</span>
              </div>
            </div>
          </section>
        </aside>

        {/* Visual Preview & Results */}
        <div className="flex flex-col overflow-hidden">
          {/* Stats Bar */}
          <div className="grid grid-cols-5 border-b border-line bg-white">
            <div className="p-6 border-r border-line">
              <span className="col-header">Total Surface</span>
              <div className="data-value text-2xl mt-1">{(totalArea * 2).toLocaleString()} <span className="text-xs opacity-50">{specs.unit}²</span></div>
            </div>
            <div className="p-6 border-r border-line">
              <span className="col-header">Front Coverage</span>
              <div className="data-value text-2xl mt-1">{calculations.frontCoverage.toFixed(2)}<span className="text-xs opacity-50">%</span></div>
            </div>
            <div className="p-6 border-r border-line">
              <span className="col-header">Reverse Coverage</span>
              <div className="data-value text-2xl mt-1">{calculations.reverseCoverage.toFixed(2)}<span className="text-xs opacity-50">%</span></div>
            </div>
            <div className="p-6 border-r border-line">
              <span className="col-header">Total Coverage</span>
              <div className="data-value text-2xl mt-1 text-ink font-bold">{calculations.coverage.toFixed(2)}<span className="text-xs opacity-50">%</span></div>
            </div>
            <div className="p-6 flex items-center justify-center gap-4">
              <div className="flex items-center gap-1 bg-ink/5 p-1 rounded-sm border border-line/10">
                <button 
                  onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))}
                  className="p-1.5 hover:bg-white hover:shadow-sm rounded-sm transition-all text-ink/60 hover:text-ink"
                  title="Zoom Out"
                >
                  <ZoomOut size={16} />
                </button>
                <div className="px-2 font-mono text-[10px] min-w-[45px] text-center">
                  {Math.round(zoom * 100 / 1.5)}%
                </div>
                <button 
                  onClick={() => setZoom(prev => Math.min(4, prev + 0.25))}
                  className="p-1.5 hover:bg-white hover:shadow-sm rounded-sm transition-all text-ink/60 hover:text-ink"
                  title="Zoom In"
                >
                  <ZoomIn size={16} />
                </button>
                <div className="w-px h-4 bg-line/10 mx-1" />
                <button 
                  onClick={() => setZoom(1.5)}
                  className="p-1.5 hover:bg-white hover:shadow-sm rounded-sm transition-all text-ink/60 hover:text-ink"
                  title="Reset Zoom"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
              <div className="flex-1 h-2 bg-ink/10 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-ink"
                  initial={{ width: 0 }}
                  animate={{ width: `${calculations.coverage}%` }}
                  transition={{ duration: 1, ease: "circOut" }}
                />
              </div>
            </div>
          </div>

          {/* Preview Area */}
          <div className="flex-1 p-12 overflow-auto bg-[radial-gradient(#141414_1px,transparent_1px)] [background-size:20px_20px] flex items-center justify-center">
            <div className="relative">
              {/* Single Preview View */}
              <div className="flex flex-col items-center gap-4">
                <span className="font-mono text-[10px] uppercase opacity-30">{activeSide} View</span>
                <div 
                  className="bg-white border-2 border-line shadow-2xl relative transition-all duration-500 overflow-hidden"
                  style={{ 
                    width: specs.width * zoom, 
                    height: specs.height * zoom,
                  }}
                >
                  {/* Bag Dimensions */}
                  <DimensionLine 
                    orientation="horizontal" 
                    length={specs.width * zoom} 
                    label={`${specs.width}${specs.unit}`}
                    className="-top-10 left-0"
                  />
                  <DimensionLine 
                    orientation="vertical" 
                    length={specs.height * zoom} 
                    label={`${specs.height}${specs.unit}`}
                    className="-left-10 top-0"
                  />
                  
                  {/* Internal Guides (Top/Bottom) */}
                  <div className="absolute top-0 left-0 w-full h-px bg-red-500/20" />
                  <div className="absolute bottom-0 left-0 w-full h-px bg-red-500/20" />
                  <div className="absolute top-0 left-0 h-full w-px bg-red-500/20" />
                  <div className="absolute top-0 right-0 h-full w-px bg-red-500/20" />

                  {specs.artworkUrl && (
                    specs.isPdf ? (
                      <iframe 
                        src={specs.artworkUrl} 
                        className="absolute inset-0 w-full h-full border-none pointer-events-none opacity-50"
                        title={`${activeSide} Artwork PDF`}
                      />
                    ) : (
                      <div 
                        className="absolute inset-0 w-full h-full bg-contain bg-center bg-no-repeat opacity-50"
                        style={{ backgroundImage: `url(${specs.artworkUrl})` }}
                      />
                    )
                  )}
                  {zones.filter(z => z.side === activeSide).map((zone) => (
                    <div 
                      key={zone.id}
                      className="absolute border border-ink/20 flex items-center justify-center overflow-hidden group"
                      style={{
                        left: zone.x * zoom,
                        top: zone.y * zoom,
                        width: zone.width * zoom,
                        height: zone.height * zoom,
                        backgroundColor: `${zone.color}33`,
                        borderColor: zone.color,
                        borderRadius: zone.type === 'circle' ? '50%' : '0'
                      }}
                    >
                      {/* Zone Dimensions (Visible on Hover) */}
                      <DimensionLine 
                        orientation="horizontal" 
                        length={zone.width * zoom} 
                        label={`${zone.width}${specs.unit}`}
                        className="top-0 left-0 opacity-0 group-hover:opacity-100 transition-opacity scale-90 origin-top"
                      />
                      <DimensionLine 
                        orientation="vertical" 
                        length={zone.height * zoom} 
                        label={`${zone.height}${specs.unit}`}
                        className="left-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity scale-90 origin-left"
                      />
                      <span className="font-mono text-[8px] opacity-50 rotate-[-45deg] whitespace-nowrap" style={{ fontSize: `${Math.max(6, 8 * (zoom / 1.5))}px` }}>{zone.name}</span>
                    </div>
                  ))}
                  {/* Grid overlay */}
                  <div className="absolute inset-0 pointer-events-none opacity-5">
                    <div className="w-full h-full bg-[linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] bg-[size:15px_15px]"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Info */}
          <footer className="p-4 border-t border-line bg-white flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#004B6D]"></div>
                <span className="font-mono text-[10px] uppercase opacity-50">Front Ink</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#008B7D]"></div>
                <span className="font-mono text-[10px] uppercase opacity-50">Reverse Ink</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-ink/40">
              <Info size={14} />
              <span className="font-serif italic text-[10px]">Calculations based on flat surface dimensions.</span>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
