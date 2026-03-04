import { transformFortuneToExcel } from '@corbe30/fortune-excel';

const testSheets = [{
    name: "Purchase Order",
    id: "sheet_01",
    status: 1,
    celldata: [{ r: 0, c: 0, v: { m: "Hello", v: "Hello", bl: 1 } }],
    config: {}
}];

const mockRef = {
    current: {
        getAllSheets: () => testSheets
    }
};

transformFortuneToExcel(mockRef as any).then(res => console.log('Mock Ref works?', !!res)).catch(e => console.error(e));
