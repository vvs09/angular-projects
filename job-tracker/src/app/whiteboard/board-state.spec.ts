import { applyServerMessage, createBoardState, lastStrokeBy } from './board-state';
import { Stroke } from './whiteboard.model';

const stroke = (id: string, userId: string, points = [0, 0, 10, 10]): Stroke => ({
    id, userId, tool: 'pen', color: '#000000', size: 3, points: [...points],
});

describe('applyServerMessage', () => {
    it('replaces the board on welcome but keeps and returns strokes drawn offline', () => {
        const state = createBoardState();
        state.strokes.set('mine', stroke('mine', 'me'));
        state.strokes.set('stale', stroke('stale', 'them'));

        const resend = applyServerMessage(state, { type: 'welcome', strokes: [stroke('server', 'them')], peers: [{ id: 'me', name: 'Me', color: '#111111' }] }, 'me');

        expect([...state.strokes.keys()]).toEqual(['server', 'mine']);
        expect(resend.map((s) => s.id)).toEqual(['mine']);
        expect(state.peers.has('me')).toBe(false);
    });

    it('extends a stroke as points stream in', () => {
        const state = createBoardState();
        applyServerMessage(state, { type: 'begin', stroke: stroke('s', 'them', [1, 1]) }, 'me');
        applyServerMessage(state, { type: 'points', id: 's', points: [2, 2, 3, 3] }, 'me');
        expect(state.strokes.get('s')!.points).toEqual([1, 1, 2, 2, 3, 3]);
    });

    it('tracks peer cursors and forgets peers who leave', () => {
        const state = createBoardState();
        applyServerMessage(state, { type: 'peer', peer: { id: 'p', name: 'Pat', color: '#3557d4' } }, 'me');
        applyServerMessage(state, { type: 'cursor', id: 'p', x: 40, y: 50 }, 'me');
        expect(state.peers.get('p')!.cursor).toEqual({ x: 40, y: 50 });
        applyServerMessage(state, { type: 'cursor', id: 'p', x: null, y: null }, 'me');
        expect(state.peers.get('p')!.cursor).toBeNull();
        applyServerMessage(state, { type: 'leave', id: 'p' }, 'me');
        expect(state.peers.size).toBe(0);
    });

    it('removes undone strokes and clears the board', () => {
        const state = createBoardState();
        applyServerMessage(state, { type: 'begin', stroke: stroke('a', 'them') }, 'me');
        applyServerMessage(state, { type: 'begin', stroke: stroke('b', 'them') }, 'me');
        applyServerMessage(state, { type: 'undo', id: 'a' }, 'me');
        expect([...state.strokes.keys()]).toEqual(['b']);
        applyServerMessage(state, { type: 'clear', by: 'them' }, 'me');
        expect(state.strokes.size).toBe(0);
    });
});

describe('lastStrokeBy', () => {
    it("finds the user's most recent stroke, skipping other people's", () => {
        const state = createBoardState();
        for (const s of [stroke('1', 'me'), stroke('2', 'me'), stroke('3', 'them')])
            state.strokes.set(s.id, s);
        expect(lastStrokeBy(state, 'me')!.id).toBe('2');
        expect(lastStrokeBy(state, 'nobody')).toBeUndefined();
    });
});
