param([string]$Guid, [string]$Slug, [string]$LongFile, [string]$SiteUrl)
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class Fill {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder t, int m);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, int d, IntPtr e);
  [DllImport("user32.dll")] public static extern void keybd_event(byte b, byte s, uint f, IntPtr e);
  public static IntPtr Find(string title) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, l) => { if (!IsWindowVisible(h)) return true; var sb = new StringBuilder(512); GetWindowTextW(h, sb, 512); if (sb.ToString().Trim() == title) { found = h; return false; } return true; }, IntPtr.Zero);
    return found;
  }
  public static void Ctrl(byte vk) { keybd_event(0x11,0,0,IntPtr.Zero); keybd_event(vk,0,0,IntPtr.Zero); keybd_event(vk,0,2,IntPtr.Zero); keybd_event(0x11,0,2,IntPtr.Zero); }
}
"@
Add-Type -AssemblyName System.Windows.Forms
$h = [Fill]::Find("API Hub - Google Chrome")
if ($h -eq [IntPtr]::Zero) { Write-Output "no window"; exit 1 }
[Fill]::ShowWindow($h, 9) | Out-Null
[Fill]::SetForegroundWindow($h) | Out-Null
Start-Sleep -Milliseconds 800

function ClickCell($x, $y) {
  [Fill]::SetCursorPos($x, $y) | Out-Null
  Start-Sleep -Milliseconds 260
  [Fill]::mouse_event(0x0002,0,0,0,[IntPtr]::Zero); [Fill]::mouse_event(0x0004,0,0,0,[IntPtr]::Zero)
  Start-Sleep -Milliseconds 600
}

# navigate
[Fill]::SetCursorPos(600,400) | Out-Null
[Fill]::Ctrl(0x4C)
Start-Sleep -Milliseconds 700
Set-Clipboard -Value ("https://rapidapi.com/studio/" + $Guid + "/publish/general")
[System.Windows.Forms.SendKeys]::SendWait("^v"); Start-Sleep -Milliseconds 400
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Start-Sleep -Seconds 14

# fill bottom-up so earlier fields do not shift
Set-Clipboard -Value "https://labs.ayamk.in/legal.html"
ClickCell 593 1024
[System.Windows.Forms.SendKeys]::SendWait("^a"); Start-Sleep -Milliseconds 180
[System.Windows.Forms.SendKeys]::SendWait("^v"); Start-Sleep -Milliseconds 700

Set-Clipboard -Value $SiteUrl
ClickCell 485 846
[System.Windows.Forms.SendKeys]::SendWait("^a"); Start-Sleep -Milliseconds 180
[System.Windows.Forms.SendKeys]::SendWait("^v"); Start-Sleep -Milliseconds 700

Set-Clipboard -Value (Get-Content -LiteralPath $LongFile -Raw)
ClickCell 593 640
[System.Windows.Forms.SendKeys]::SendWait("^a"); Start-Sleep -Milliseconds 180
[System.Windows.Forms.SendKeys]::SendWait("^v"); Start-Sleep -Milliseconds 1400

ClickCell 350 1073
Start-Sleep -Seconds 7
Write-Output ("filled " + $Slug)
