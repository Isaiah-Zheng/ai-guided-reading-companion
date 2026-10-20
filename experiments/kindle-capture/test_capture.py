import tempfile
import unittest
from pathlib import Path
import kindle_capture as c


class CaptureTests(unittest.TestCase):
    def test_auto_copy_accepts_text_without_initial_text(self):
        win = FakeWindows(auto=True)
        self.assertEqual(c.capture_screen(win, (0,0), (1,1), 1, clock=win.clock), 'new selected text')
        self.assertFalse(win.pressed_copy)

    def test_delayed_copy_is_awaited_without_ctrl_c(self):
        win = FakeWindows(auto=False, ready_at=10)
        self.assertEqual(c.capture_screen(win, (0,0), (1,1), 1, clock=win.clock), 'new selected text')
        self.assertGreaterEqual(win.now, 15)
        self.assertFalse(win.pressed_copy)

    def test_text_must_stabilize_after_a_later_update(self):
        win = FakeWindows(auto=True, update_at=3)
        self.assertEqual(c.capture_screen(win, (0,0), (1,1), 1, clock=win.clock), 'new selected text FINAL')
        self.assertGreaterEqual(win.now, 8)

    def test_same_opening_different_lengths_is_rejected(self):
        opening = 'Synthetic opening for a repeated sample page. ' * 15
        with self.assertRaises(c.CaptureError):
            c.reject_same_page(opening+'long ending', opening[:450])

    def test_different_page_opening_is_allowed(self):
        c.reject_same_page('A different page. '*40, 'Synthetic opening. '*50)

    def test_unchanged_clipboard_is_never_saved(self):
        win = FakeWindows(auto=False, fail=True)
        with self.assertRaises(c.CaptureError):
            c.capture_screen(win, (0,0), (1,1), 1, clock=win.clock)
        self.assertEqual(win.reads, 0)

    def test_no_copy(self):
        for text in (None, '', 'pending'):
            with self.subTest(text=text), self.assertRaises(c.CaptureError):
                c.validate_copy(text, 'pending', set(), 5)

    def test_short_page_stops(self):
        with self.assertRaises(c.CaptureError):
            c.validate_copy('abc', 'pending', set(), 5)

    def test_duplicate_ignores_whitespace(self):
        with self.assertRaises(c.CaptureError):
            c.validate_copy('same\n page text', 'pending', {c.fingerprint('same page text')}, 5)

    def test_new_page_passes(self):
        self.assertEqual(c.validate_copy('new page text', 'pending', set(), 5), c.fingerprint('new page text'))

    def test_raw_text_saved_and_never_overwritten(self):
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d)
            source = 'Sample text\nUnicode \u03a9  with spacing'
            manifest = {'pages':[]}
            c.save_page(folder, 1, source, manifest)
            self.assertEqual((folder/'page_0001.txt').read_text(encoding='utf-8'), source)
            with self.assertRaises(FileExistsError):
                c.save_page(folder, 1, 'replacement', manifest)
            self.assertEqual(len(manifest['pages']), 1)
            c.combine(folder, manifest)
            self.assertIn(source, (folder/'combined.txt').read_text(encoding='utf-8'))


class FakeWindows:
    def __init__(self, auto, fail=False, ready_at=None, update_at=None):
        self.auto, self.fail = auto, fail
        self.sequence, self.reads = 10, 0
        self.pressed_copy = False
        self.now = 0
        self.ready_at, self.update_at = ready_at, update_at

    def clock(self): return self.now
    def clipboard_sequence(self):
        if self.ready_at is not None and self.now >= self.ready_at:
            return 11
        if self.update_at is not None and self.now >= self.update_at:
            return 12
        return self.sequence
    def check_window(self, hwnd): pass
    def wait(self, seconds): self.now += seconds
    def drag(self, start, end, hwnd):
        if self.auto: self.sequence += 1
    def copy_key(self, hwnd):
        self.pressed_copy = True
        if not self.fail: self.sequence += 1
    def read_clipboard(self):
        self.reads += 1
        return 'new selected text'+(' FINAL' if self.update_at is not None and self.now >= self.update_at else '')


if __name__ == '__main__':
    unittest.main()
