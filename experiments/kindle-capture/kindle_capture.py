"""Windows visible-page copy helper. Python 3.10+, no third-party packages."""
import argparse
import ctypes
from ctypes import wintypes
from datetime import datetime
import hashlib
from difflib import SequenceMatcher
import json
from pathlib import Path
import re
import sys
import time
import uuid


class CaptureError(Exception):
    pass


def fingerprint(text):
    return hashlib.sha256(re.sub(r'\s+', ' ', text).strip().encode('utf-8')).hexdigest()


def validate_copy(text, marker, seen, minimum):
    if not text or text == marker:
        raise CaptureError('Copy failed or clipboard did not change. Nothing saved; no next-page click.')
    if len(text.strip()) < minimum:
        raise CaptureError('Too little text copied. Check selection, final page, or copy restrictions.')
    key = fingerprint(text)
    if key in seen:
        raise CaptureError('Repeated text detected: page may not have changed. Stopped without saving a duplicate.')
    return key


def save_page(folder, index, text, manifest):
    name = f'page_{index:04d}.txt'
    # Exclusive creation: a previous page is never overwritten.
    with (folder / name).open('x', encoding='utf-8', newline='') as f:
        f.write(text)
    manifest['pages'].append({'file': name, 'characters': len(text), 'sha256_normalized': fingerprint(text)})
    manifest['status'] = 'running'
    write_manifest(folder, manifest)


def write_manifest(folder, manifest):
    temporary = folder / 'manifest.tmp'
    temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    temporary.replace(folder / 'manifest.json')


def combine(folder, manifest):
    # Keep page boundaries explicit; do not silently merge or rewrite the source.
    text = '\n\n'.join(f'===== CAPTURE {i} =====\n' + (folder / p['file']).read_text(encoding='utf-8')
                       for i, p in enumerate(manifest['pages'], 1))
    (folder / 'combined.txt').write_text(text, encoding='utf-8')


def reject_same_page(text, previous_text):
    if not previous_text:
        return
    current = re.sub(r'\s+', ' ', text).strip()
    previous = re.sub(r'\s+', ' ', previous_text).strip()
    if min(len(current), len(previous)) >= 200:
        size = min(400, len(current), len(previous))
        if SequenceMatcher(None, current[:size], previous[:size], autojunk=False).ratio() >= 0.95:
            raise CaptureError('Same page opening detected with different capture length. Page turn not verified; stopped.')


def capture_screen(win, start, end, hwnd, timeout=30.0, stable_seconds=5.0, clock=time.monotonic):
    """Wait for new automatically copied text to remain unchanged; never inject Ctrl+C."""
    win.check_window(hwnd)
    previous = win.clipboard_sequence()
    win.drag(start, end, hwnd)
    print('Waiting for auto-copy (up to '+str(int(timeout))+' seconds); then '+str(int(stable_seconds))+' seconds stable...', flush=True)
    deadline = clock() + timeout
    candidate = None
    sequence = previous
    stable_since = None
    while clock() < deadline:
        win.wait(0.1)
        win.check_window(hwnd)
        now_sequence = win.clipboard_sequence()
        if now_sequence != previous:
            text = win.read_clipboard()
            if text:
                if text != candidate or now_sequence != sequence:
                    candidate, sequence, stable_since = text, now_sequence, clock()
                elif stable_since is not None and clock() - stable_since >= stable_seconds:
                    return candidate
            else:
                candidate, stable_since = None, None
        else:
            candidate, stable_since = None, None
    raise CaptureError('Auto-copy did not produce stable NEW text within the timeout. No next-page click.')


class Windows:
    def __init__(self):
        if sys.platform != 'win32':
            raise CaptureError('This script requires Windows.')
        self.u = ctypes.WinDLL('user32', use_last_error=True)
        self.k = ctypes.WinDLL('kernel32', use_last_error=True)
        self.u.GetForegroundWindow.restype = wintypes.HWND
        self.u.GetClipboardSequenceNumber.restype = wintypes.DWORD
        self.u.GetAncestor.argtypes = [wintypes.HWND, wintypes.UINT]
        self.u.GetAncestor.restype = wintypes.HWND
        self.u.WindowFromPoint.argtypes = [wintypes.POINT]
        self.u.WindowFromPoint.restype = wintypes.HWND
        self.u.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
        self.u.GetWindowTextLengthW.argtypes = [wintypes.HWND]
        self.u.GetCursorPos.argtypes = [ctypes.POINTER(wintypes.POINT)]
        self.u.GetAsyncKeyState.argtypes = [ctypes.c_int]
        self.u.GetAsyncKeyState.restype = ctypes.c_short
        self.u.SetCursorPos.argtypes = [ctypes.c_int, ctypes.c_int]
        self.u.OpenClipboard.argtypes = [wintypes.HWND]
        self.u.GetClipboardData.argtypes = [wintypes.UINT]
        self.u.GetClipboardData.restype = wintypes.HANDLE
        self.u.SetClipboardData.argtypes = [wintypes.UINT, wintypes.HANDLE]
        self.u.SetClipboardData.restype = wintypes.HANDLE
        self.k.GlobalAlloc.argtypes = [wintypes.UINT, ctypes.c_size_t]
        self.k.GlobalAlloc.restype = wintypes.HGLOBAL
        self.k.GlobalLock.argtypes = [wintypes.HGLOBAL]
        self.k.GlobalLock.restype = ctypes.c_void_p
        self.k.GlobalUnlock.argtypes = [wintypes.HGLOBAL]
        self.k.GlobalFree.argtypes = [wintypes.HGLOBAL]
        self.k.GlobalFree.restype = wintypes.HGLOBAL
        self.u.CreateWindowExW.argtypes = [wintypes.DWORD, wintypes.LPCWSTR, wintypes.LPCWSTR,
                                          wintypes.DWORD, ctypes.c_int, ctypes.c_int,
                                          ctypes.c_int, ctypes.c_int, wintypes.HWND,
                                          wintypes.HMENU, wintypes.HINSTANCE, ctypes.c_void_p]
        self.u.CreateWindowExW.restype = wintypes.HWND
        # A private message-only window is a valid clipboard owner; NULL is not.
        self.clipboard_owner = self.u.CreateWindowExW(0, 'STATIC', '', 0, 0, 0, 0, 0,
                                                     wintypes.HWND(-3), None, None, None)
        if not self.clipboard_owner:
            raise CaptureError('Cannot create clipboard owner window.')
        try:
            ctypes.WinDLL('shcore').SetProcessDpiAwareness(2)
        except (OSError, AttributeError):
            self.u.SetProcessDPIAware()

    def stop_check(self):
        if self.u.GetAsyncKeyState(0x78) & 0x8000:  # F9
            raise CaptureError('Stopped by F9.')

    def clipboard_sequence(self):
        return self.u.GetClipboardSequenceNumber()

    def wait(self, seconds):
        until = time.monotonic() + seconds
        while time.monotonic() < until:
            self.stop_check()
            time.sleep(min(0.04, max(0, until-time.monotonic())))

    def position(self):
        p = wintypes.POINT()
        if not self.u.GetCursorPos(ctypes.byref(p)):
            raise CaptureError('Cannot read pointer position.')
        return (p.x, p.y)

    def calibrate(self, label):
        print('\n'+label+' Move the mouse there, then press F8. F9 cancels.', flush=True)
        while self.u.GetAsyncKeyState(0x77) & 0x8000:
            self.wait(0.05)
        while not self.u.GetAsyncKeyState(0x77) & 0x8000:
            self.wait(0.04)
        point = self.position()
        hwnd = self.u.GetForegroundWindow()
        under = self.u.GetAncestor(self.u.WindowFromPoint(wintypes.POINT(*point)), 2)
        if not hwnd or under != hwnd:
            raise CaptureError('Pointer must be inside the active browser window. Click the book first.')
        print('Recorded:', point, flush=True)
        while self.u.GetAsyncKeyState(0x77) & 0x8000:
            self.wait(0.05)
        return point, hwnd

    def title(self, hwnd):
        buf = ctypes.create_unicode_buffer(self.u.GetWindowTextLengthW(hwnd)+1)
        self.u.GetWindowTextW(hwnd, buf, len(buf))
        return buf.value

    def check_window(self, hwnd):
        self.stop_check()
        if self.u.GetForegroundWindow() != hwnd:
            raise CaptureError('Active window changed. Stopped to avoid copying or clicking another application.')

    def move(self, point, hwnd):
        self.check_window(hwnd)
        under = self.u.GetAncestor(self.u.WindowFromPoint(wintypes.POINT(*point)), 2)
        if under != hwnd:
            raise CaptureError('Capture point is no longer inside the browser. Recalibrate.')
        if not self.u.SetCursorPos(*point):
            raise CaptureError('Cannot move the pointer.')

    def click(self, point, hwnd):
        self.move(point, hwnd)
        self.u.mouse_event(2, 0, 0, 0, 0)
        self.u.mouse_event(4, 0, 0, 0, 0)

    def drag(self, start, end, hwnd):
        self.move(start, hwnd)
        self.u.mouse_event(2, 0, 0, 0, 0)
        try:
            for i in range(1, 31):
                point = tuple(round(a+(b-a)*i/30) for a,b in zip(start,end))
                self.move(point, hwnd)
                self.wait(0.025)
        finally:
            self.u.mouse_event(4, 0, 0, 0, 0)

    def copy_key(self, hwnd):
        self.check_window(hwnd)
        self.u.keybd_event(0x11, 0, 0, 0)
        try:
            self.u.keybd_event(0x43, 0, 0, 0)
            self.u.keybd_event(0x43, 0, 2, 0)
        finally:
            self.u.keybd_event(0x11, 0, 2, 0)

    def open_clipboard(self):
        for _ in range(30):
            if self.u.OpenClipboard(self.clipboard_owner):
                return
            self.wait(0.04)
        raise CaptureError('Clipboard is busy.')

    def read_clipboard(self):
        self.open_clipboard()
        try:
            handle = self.u.GetClipboardData(13)  # CF_UNICODETEXT
            if not handle:
                return None
            ptr = self.k.GlobalLock(handle)
            if not ptr:
                raise CaptureError('Cannot read clipboard.')
            try:
                return ctypes.wstring_at(ptr)
            finally:
                self.k.GlobalUnlock(handle)
        finally:
            self.u.CloseClipboard()

    def write_clipboard(self, text):
        data = (text+'\0').encode('utf-16-le')
        # GMEM_MOVEABLE is mandatory for clipboard handles.
        handle = self.k.GlobalAlloc(0x0002, len(data))
        if not handle:
            raise CaptureError('Cannot allocate clipboard memory.')
        owned = True
        try:
            ptr = self.k.GlobalLock(handle)
            if not ptr:
                raise CaptureError('Cannot lock clipboard memory.')
            try:
                ctypes.memmove(ptr, data, len(data))
            finally:
                self.k.GlobalUnlock(handle)
            self.open_clipboard()
            try:
                if not self.u.EmptyClipboard() or not self.u.SetClipboardData(13, handle):
                    raise CaptureError('Cannot set clipboard text.')
                owned = False
            finally:
                self.u.CloseClipboard()
        finally:
            if owned:
                self.k.GlobalFree(handle)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pages', type=int, default=5, help='Number of visible screens to capture (default: 5)')
    parser.add_argument('--delay', type=float, default=3.0, help='Seconds to wait after turning a page')
    parser.add_argument('--min-chars', type=int, default=40, help='Stop if copied text is shorter (default: 40)')
    parser.add_argument('--copy-timeout', type=float, default=30, help='Maximum wait for stable automatically copied text')
    parser.add_argument('--stable-seconds', type=float, default=5, help='Clipboard must remain unchanged this long')
    parser.add_argument('--before-turn', type=float, default=2, help='Extra wait before clicking next page')
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parent/'captures')
    args = parser.parse_args()
    if not 1 <= args.pages <= 500 or args.delay < 1 or args.min_chars < 1:
        parser.error('pages must be 1..500; delay >= 1; min-chars >= 1')
    if args.stable_seconds < 1 or args.copy_timeout <= args.stable_seconds or args.before_turn < 0:
        parser.error('stable-seconds >= 1; copy-timeout > stable-seconds; before-turn >= 0')
    if sys.platform != 'win32':
        parser.error('Windows only')
    win = Windows()
    print('Kindle visible-page capture v3 | F8 calibrates | F9 stops\n'
          'Use ONE text column. Keep font, zoom, window size and layout fixed.\n'
          'No passwords, downloads, decryption, AI calls or network requests are used.\n'
          'Do not touch the mouse/keyboard while capturing.\n'
          'Copy/publisher limits are not bypassed. Stop if the site reports a limit.\n'
          'No initial clipboard text needed. Last copied text remains on the clipboard.\n', flush=True)
    start, hwnd = win.calibrate('1/3: FIRST visible letter, using the start point that works with manual selection.')
    end, hwnd2 = win.calibrate('2/3: LAST visible letter. Stay on text, not outer blank space or page footer.')
    next_point, hwnd3 = win.calibrate('3/3: Centre of the NEXT PAGE arrow (make it visible if necessary).')
    if hwnd != hwnd2 or hwnd != hwnd3 or start == end:
        raise CaptureError('All calibration points must belong to the same browser window; selection must be nonempty.')
    print('Target window:', win.title(hwnd), flush=True)
    print('Starting in 5 seconds. Keep the book focused. F9 stops.', flush=True)
    win.wait(5)
    win.check_window(hwnd)
    folder = args.output.resolve() / (datetime.now().strftime('%Y%m%d_%H%M%S')+'_'+uuid.uuid4().hex[:6])
    folder.mkdir(parents=True, exist_ok=False)
    manifest = {'status':'starting', 'requested_screens':args.pages, 'pages':[],
                'note':'Capture numbers are not Kindle page/location numbers. Completeness requires manual checking.'}
    seen = set()
    last_text = None
    try:
        for index in range(1, args.pages+1):
            text = capture_screen(win, start, end, hwnd, args.copy_timeout, args.stable_seconds)
            key = validate_copy(text, None, seen, args.min_chars)
            reject_same_page(text, last_text)
            save_page(folder, index, text, manifest)
            seen.add(key)
            last_text = text
            print(f'Saved {index}/{args.pages}: {len(text)} characters', flush=True)
            if index < args.pages:
                print('Copy stable. Waiting before next-page click...', flush=True)
                win.wait(args.before_turn)
                win.check_window(hwnd)
                if fingerprint(win.read_clipboard() or '') != fingerprint(text):
                    raise CaptureError('Clipboard changed during pre-turn wait. Last saved capture needs checking; no page turn.')
                win.click(next_point, hwnd)
                win.wait(args.delay)
        manifest['status'] = 'completed_requested_batch'
    except (CaptureError, KeyboardInterrupt) as exc:
        manifest['status'] = 'stopped'
        manifest['reason'] = str(exc) or 'Keyboard interrupt'
        print('\nStopped:', manifest['reason'], flush=True)
    finally:
        write_manifest(folder, manifest)
        combine(folder, manifest)
        print('Saved folder:', folder, flush=True)
        print('Check the FIRST and LAST words of every captured screen against the book.', flush=True)
    return 0 if manifest['status']=='completed_requested_batch' else 1


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except CaptureError as exc:
        print('Stopped:', exc, file=sys.stderr)
        raise SystemExit(1)
