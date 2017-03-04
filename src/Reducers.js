//@flow

import {CopyUserFunc, MakeUserFunc} from './UserFunction';
import {MakeStateError, MakeStateWarning, MakeStateGood} from './StoreTypes';
import {initialState} from './StoreTypes';

import type {UserFunction, FuncArray} from './UserFunction';
import type {GraphState, FunctionProblem, DisplayStateType} from './StoreTypes';
import type {
  CoasterAction,
  AddFunctionAction,
  DeleteFunctionAction,
  EditFunctionAction,
  ChangeDividerAction,
  MoveFunctionAction,
  SelectFunctionAction,
  ClearEditorAction,
  ScaleChangeAction,
  WindowsResizeAction,
  SettingsAction,
  AllFuncsAction} from './Actions';

const nobj = (a:Object, b:Object):Object => Object.assign({}, a, b);

export const FuncProblems = {
  UnorderedRange: 0,
  Discontinuous: 1,
  ParseFailure: 2,
  EvaluationFail: 3,
  Make: (func:number, problem: string|number): FunctionProblem => ({
    func, problem
  })
};

const ValidateFuncs = (funcs:FuncArray):DisplayStateType => {
  let prevHi:?number = undefined;
  let prevY:?number = undefined;
  // TODO: Check for smoothness of transitions and warn
  let i = 0;
  for (let func of funcs) {
    i++;
    try {
      if (func.range.low > func.range.high) {
        return MakeStateError(
          FuncProblems.Make(i, FuncProblems.UnorderedRange));
      }
      if (prevHi && Math.abs(prevHi - func.range.low) > 1e-6) {
        return MakeStateError(
          FuncProblems.Make(i, 'X range is not continuous (Bug in app!)'));
      }
      const curY = func.func(func.range.low);
      if (prevY && Math.abs(prevY - curY) > 1e-6) {
        return MakeStateWarning(
          FuncProblems.Make(i, FuncProblems.Discontinuous));
      }
      prevHi = func.range.high;
      prevY = func.func(prevHi);
    } catch (e) {
      return MakeStateError(
        FuncProblems.Make(i, FuncProblems.EvaluationFail));
    }
  }
  return MakeStateGood();
}

const UpdateFunctions = (
    originalState: GraphState,
    funcs: FuncArray,
    displayState:DisplayStateType,
    currentEdit:number): GraphState =>
  nobj(originalState, { funcs, displayState, currentEdit });

const CheckFunctions =
  (origState:GraphState, funcs: FuncArray, currentEdit:number):GraphState =>
  UpdateFunctions(origState, funcs, ValidateFuncs(funcs), currentEdit);

const sliceOut = (
  funcs:FuncArray,
  pos:number):{bArr:FuncArray,func:UserFunction,eArr:FuncArray} => {
  const bArr = funcs.slice(0,pos);
  const eArr = funcs.slice(pos+1,funcs.length);
  return {bArr, func:funcs[pos], eArr};
};

const editFunctionReducer =
  (state:GraphState, action:EditFunctionAction):GraphState => {
  let funcs = state.funcs;
  const pos = action.position;
  if (pos < 0 || pos > funcs.length) {
    console.log('Invalid edit function request for current state');
    return state;
  }
  const {bArr, func, eArr} = sliceOut(funcs, pos);
  const newFunc:(UserFunction|string) =
    MakeUserFunc(action.funcBody, func.range.low, func.range.high);
  if (typeof newFunc === 'string') {
    return UpdateFunctions(
      state,
      funcs,
      MakeStateWarning(
        FuncProblems.Make(pos, FuncProblems.ParseFailure)), state.currentEdit);
  }
  funcs = [...bArr, newFunc, ...eArr];
  const displayState = ValidateFuncs(funcs);
  return UpdateFunctions(
    state,
    funcs,
    displayState,
    (displayState.state === 'GOOD') ? -1 : state.currentEdit);
};

const deleteFunctionReducer =
  (state:GraphState, action:DeleteFunctionAction):GraphState => {
  let funcs = state.funcs;
  const pos = action.position;
  if (pos < 0 || pos > funcs.length) {
    console.log('Invalid delete function request for current state');
    return state;
  }
  const {bArr, func, eArr} = sliceOut(funcs, pos);
  // Fill in the gap in the range
  const high = func.range.high;
  if (bArr.length > 0) {
    bArr[bArr.length-1].range.high = high;
  } else if (eArr.length > 0) {
    eArr[0].range.low = 0;
  } else {
    console.log('Invalid delete function results');
  }
  funcs = [...bArr, ...eArr];
  let currentEdit = state.currentEdit;
  if (currentEdit === pos) {
    currentEdit = -1;
  } else if (currentEdit > pos) {
    currentEdit--;
  }
  return CheckFunctions(state, funcs, currentEdit);
};

const addFunctionReducer =
  (state:GraphState, action:AddFunctionAction):GraphState => {
  let funcs = state.funcs;
  const r = funcs[funcs.length - 1].range.high;
  const func = MakeUserFunc(action.expr, r, r+1);
  if (typeof func === 'string') {
    return UpdateFunctions(
      state,
      funcs,
      MakeStateError(FuncProblems.Make(-1, FuncProblems.EvaluationFail)),
      state.currentEdit);
  }
  funcs = [...funcs, func];
  const isValid = ValidateFuncs(funcs);
  if (isValid.state === 'GOOD') {
    return UpdateFunctions(state, funcs, isValid, -1);
  }
  return UpdateFunctions(state, funcs, isValid, funcs.length - 1);
};

const allFuncsReducer =
  (state:GraphState, action:AllFuncsAction):GraphState => {
  const funcs = CheckFunctions(state, action.value, -1);
  return funcs;
}

// Gives you 4 pieces: the functions before & after the "center"
// As well as the func array before & after those two
// If you pass it the beginning or end, it f1 or f2 will be undefined
const sliceTwoOut = (
  funcs:FuncArray,
  pos:number
):{bArr:FuncArray, f1:?UserFunction, f2:?UserFunction, eArr:FuncArray} => {
  if (pos < 1) {
    return {
      bArr:[],
      f1:undefined,
      f2:funcs[0],
      eArr:funcs.slice(1,funcs.length)
    };
  }
  if (pos >= funcs.length) {
    return {
      bArr:funcs.slice(0, funcs.length - 1),
      f1:funcs[funcs.length-1],
      f2:undefined,
      eArr:[]
    };
  }
  return {
    bArr:funcs.slice(0,pos-1),
    f1:funcs[pos-1],
    f2:funcs[pos],
    eArr:funcs.slice(pos+1)
  };
};

const changeDividerReducer =
  (state:GraphState, action:ChangeDividerAction):GraphState => {
  const funcs = state.funcs;
  const pos = parseFloat(action.position);
  const val = parseFloat(action.value.toString());
  if (pos > funcs.length || pos < 0) {
    console.log('Invalid change divider request for current state');
    return state;
  }
  // Get the two functions we're modifying
  let {bArr, f1:hiFunc, f2:loFunc, eArr} = sliceTwoOut(funcs, pos);
  // Modify the hi & lo ranges
  let result:FuncArray = [];
  if (hiFunc) {
    hiFunc = CopyUserFunc(hiFunc, hiFunc.range.low, val);
  }
  if (loFunc) {
    loFunc = CopyUserFunc(loFunc, val, loFunc.range.high);
  }
  if (hiFunc && loFunc) {
    result = [...bArr, hiFunc, loFunc, ...eArr];
  } else if (hiFunc) {
    result = [...bArr, hiFunc];
  } else if (loFunc) {
    result = [loFunc, ...eArr];
  }
  return CheckFunctions(state, result, state.currentEdit);
};

const moveFunctionReducer =
  (state:GraphState, action:MoveFunctionAction):GraphState => {
  let funcs = state.funcs;
  const pos = action.position;
  const up = action.up;
  if (pos < (up ? 1 : 0) || pos > (funcs.length - (up ? 0 : 1))) {
    console.log('Invalid function move request for current state');
    return state;
  }
  const {bArr, f1, f2, eArr} = sliceTwoOut(funcs, pos + (up ? 0 : 1));
  if (!f1 || !f2) {
    console.log('Inconsistent state detected');
    return state;
  }
  const n1 = CopyUserFunc(f2, f1.range.low, f1.range.high);
  const n2 = CopyUserFunc(f1, f2.range.low, f2.range.high);
  funcs = [...bArr, n1, n2, ...eArr];
  return CheckFunctions(state, funcs, state.currentEdit);
};

const selectFunctionReducer =
  (state:GraphState, action:SelectFunctionAction):GraphState => {
  return CheckFunctions(state, state.funcs, action.position);
};

const clearEditorReducer =
  (state:GraphState, action:ClearEditorAction): GraphState => {
  return CheckFunctions(state, state.funcs, -1);
};

const changeScaleReducer =
  (state:GraphState, action:ScaleChangeAction): GraphState => {
  const val = parseFloat(action.value);
  if (val > 1e-2) {
    return nobj(state, {scale: val});
  }
  return state;
};

const changeAnimationReducer =
  (state:GraphState, start:boolean): GraphState =>
  nobj(state, start
    ? {running: true, startTime: Date.now(), time: 0}
    : {running: false});

const tickReducer = (state: GraphState): GraphState =>
  state.running ? nobj(state, {millisec: Date.now() - state.startTime}) : state;

const windowResizeReducer =
  (state: GraphState, action: WindowsResizeAction): GraphState =>
  nobj(state, { size: { width:action.width, height:action.height } });

const settingsReducer = (state: GraphState, action: SettingsAction):GraphState =>
  nobj(state, {
    showCart: action.value.cart,
    showVector: action.value.velocity,
    showLabels: action.value.labels
  });

const internalCoasterReducer =
  (state:GraphState = initialState, action:CoasterAction): GraphState => {
  switch (action.type) {
    case 'ADD_FUNCTION':
      return addFunctionReducer(state, action);
    case 'DELETE_FUNCTION':
      return deleteFunctionReducer(state, action);
    case 'EDIT_FUNCTION':
      return editFunctionReducer(state, action);
    case 'CHANGE_LIMIT':
      return changeDividerReducer(state, action);
    case 'MOVE_FUNCTION':
      return moveFunctionReducer(state, action);
    case 'SELECT_FUNCTION':
      return selectFunctionReducer(state, action);
    case 'CLEAR_EDITOR':
      return clearEditorReducer(state, action);
    case 'START_ANIMATION':
      return changeAnimationReducer(state, true);
    case 'STOP_ANIMATION':
      return changeAnimationReducer(state, false);
    case 'CHANGE_SCALE':
      return changeScaleReducer(state, action);
    case 'TICK':
      return tickReducer(state);
    case 'WINDOW_RESIZE':
      return windowResizeReducer(state, action);
    case 'SETTINGS':
      return settingsReducer(state, action);
    case 'ALL_FUNCS':
      return allFuncsReducer(state, action);
    default:
      return state;
  }
};

export const CoasterReducer =
  (state:GraphState, action:CoasterAction): GraphState => {
  const res = internalCoasterReducer(state, action);
  return res;
};