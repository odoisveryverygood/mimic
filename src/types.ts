export type StepType = 'navigate'|'click'|'fill'|'select'|'check'|'press'|'extract'|'manual'|'assert';
export type Step = {id:string;type:StepType;label:string;selector?:string;alternatives?:string[];value?:string;url?:string;origin?:string;parameter?:string;checkpoint:boolean;secret:boolean};
export type Parameter = {key:string;label:string;default:string;examples:string[]};
export type Command = {id:string;name:string;description:string;steps:Step[];parameters:Parameter[];createdAt:string;updatedAt:string;demonstrationIds:string[];sample:boolean};
export type Demo = {id:string;name:string;url:string;commandId?:string;startedAt:string;finishedAt?:string;durationMs?:number;status:string;steps:Step[];warnings:string[]};
export type Run = {id:string;commandId:string;commandName:string;mode:'test'|'run';status:string;startedAt:string;finishedAt?:string;currentStep:number;message?:string;error?:string;kind?:string;phase?:string;sourceHash?:string;testHash?:string;outputs:{label:string;text:string}[];steps:{id:string;label:string;type:StepType;status:string}[]};
export type State = {version:string;commands:Command[];demonstrations:Demo[];runs:Run[];recording:Demo|null;activeRun:Run|null;browserOpen:boolean;busy:boolean;token:string;practiceUrl:string;connected?:boolean;capabilities?:string[]};
