"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var x;
jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    readFileSync: jest.fn().mockImplementation(() => {
        console.log('readFileSync called, x =', x);
        return x;
    }),
}));
const fs_1 = __importDefault(require("fs"));
x = { hello: 'world' };
test('debug closure', () => {
    const result = fs_1.default.readFileSync();
    console.log('result =', result);
    expect(result).toBe(x);
});
