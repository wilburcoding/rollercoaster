//@flow

import React, {Component} from 'react';
import {getPosition} from './PhysicSim';
import {FuncArrayString} from './UserFunction';

import type {UserFunction, Vector} from './UserFunction';

// Super duper exciting constant
const twoPi = Math.PI * 2;
// Function colors
const strokes = [
  '#060', '#006', '#600', '#066', '#606', '#660',
  '#A00', '#0A0', '#00A', '#0AA', '#A0A', '#AA0'
];

const hx = (i: number): string => {
  const str = Math.round(i).toString(16);
  return str.length === 1 ? `0${str}` : str;
};

const b = (i: number): string => {
  // This 'bounces' a value between 0 and 255, and returns it in hex
  return hx(Math.abs(255 - (i % 510)));
}

// This isn't particularly safe, but I hate typing "this.xf(x)" everywhere :(
let scale = 30; // Scale of the graph
let graphStep = 1/scale; // The steps used for drawing the graph
const xf = (x: number): number => 10.0 + x * scale;
const yf = (y: number): number => 500.0 - y * scale;

type FuncGraphProps = {funcs:Array<UserFunction>, selected:number, scale:number};

export class FuncGraph extends Component {
  props:FuncGraphProps;
  state:{lastFuncs:string};


  // TODO: Add some numeric labels, maybe?
  drawGraphPaper(ctx: CanvasRenderingContext2D) {
    for (let pos = -100; pos <= 120; pos += .5) {
      ctx.beginPath();
      ctx.strokeStyle = '#000';
      if (Math.round(pos + .1) === Math.round(pos - .1)) {
        ctx.lineWidth = pos ? .15 : .5;
      } else {
        ctx.lineWidth = .05;
      }
      ctx.moveTo(xf(pos), yf(-100));
      ctx.lineTo(xf(pos), yf(100));
      ctx.moveTo(xf(-10), yf(pos));
      ctx.lineTo(xf(120), yf(pos));
      ctx.stroke();
    }
  }
  // This draws the lines for the function on the graph:
  drawFunctions(ctx: CanvasRenderingContext2D, funcs: Array<UserFunction>): void {
    let curStroke = 0;
    for (let f of funcs) {
      let x = f.range.low;
      let y = f.func(x);
      ctx.beginPath();
      ctx.fillStyle = '#000';
      ctx.arc(xf(x), yf(y), 2.5, 0, twoPi);
      ctx.fill();
      ctx.beginPath();
      ctx.strokeStyle = strokes[curStroke];
      ctx.fillStyle = strokes[curStroke];
      ctx.lineWidth = 0.25;
      curStroke = (curStroke + 1) % strokes.length;
      ctx.moveTo(xf(x), yf(y));
      const e = f.range.high;
      while (x < e) {
        let fail = false;
        try {
          y = f.func(x);
          fail = Number.isNaN(y);
        } catch (e) {
          fail = true;
        }
        if (!fail)
          ctx.lineTo(xf(x), yf(y));
        x += graphStep;
      }
      y = f.func(e);
      ctx.lineTo(xf(e), yf(y));
      ctx.stroke();
      ctx.beginPath();
      ctx.fillStyle = '#000';
      ctx.arc(xf(e), yf(y), 2.5, 0, twoPi);
      ctx.fill();
    }
  }
  constructor(props:FuncGraphProps) {
    super(props);
    this.state = {lastFuncs:''};
  }
  componentDidMount() {
    this.updateCanvas();
  }
  componentDidUpdate() {
    this.updateCanvas();
  }
  updateCanvas() {
    const canvas = this.refs.FuncGraph;
    const ctx: CanvasRenderingContext2D = canvas.getContext('2d');
    const funcs: Array<UserFunction> = this.props.funcs;
    const funcStr = FuncArrayString(funcs) + scale;
    if (this.state.lastFuncs === funcStr) {
      // We want an early exit, because we're overriding the rendering logic...
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.drawGraphPaper(ctx, this.refs.FuncGraph);
    this.drawFunctions(ctx, funcs);
    for (let t = 0; t <= 5; t += .03125) {
      const vec: Vector = getPosition(funcs, t);
      ctx.beginPath();
      const n = Math.round(t * 32);
      ctx.fillStyle = `#${b(n)}${b((n + 128) * 5)}${b(n * 3)}`;
      ctx.arc(xf(vec.origin.x), yf(vec.origin.y), 1.5, 0, twoPi);
      ctx.fill();

      if (false) {
        // This draws the velocity vector on the graph
        ctx.beginPath();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = .2;
        const xo = vec.origin.x;
        const yo = vec.origin.y;
        ctx.moveTo(xf(xo), yf(yo));
        const xe = xo + Math.cos(vec.angle) * vec.magnitude;
        const ye = yo + Math.sin(vec.angle) * vec.magnitude;
        ctx.lineTo(xf(xe), yf(ye));
        ctx.stroke();
      }
    }
    this.setState({lastFuncs:funcStr});
  }
  render() {
    scale = this.props.scale || 30;
    graphStep = 1/scale;
    const s = {border : '1px solid #91f', height : '600px', width : '600px'};
    return (<canvas ref='FuncGraph' width={600} height={600} style={s}/>);
  }
};

type GraphSettingsProps = {
  onScaleChange: (a:string)=>void,
  onPlay:(a:boolean)=>void,
  scale:number,
  time:number,
  running:boolean
};

export const GraphSettings = ({onScaleChange, onPlay, scale, time, running}:GraphSettingsProps) => {
  return (<div>
    <label>Scale:</label><input type='text' value={scale} onChange={e => onScaleChange(e.target.value)}/>
    <button onClick={() => onPlay(!running)}>{running?'Stop':'Play'}</button><br/>
    <label>Current time: {(time > 0) ? time : 'Stopped'}</label>
  </div>);
};
