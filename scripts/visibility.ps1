param([string]$Guid, [string]$Phase)
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class Vis {
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
  public static void Click(int x, int y) {
    SetCursorPos(x, y);
    System.Threading.Thread.Sleep(280);
    mouse_event(0x0002,0,0,0,IntPtr.Zero); mouse_event(0x0004,0,0,0,IntPtr.Zero);
    System.Threading.Thread.Sleep(700);
  }
}
"@
Add-Type -AssemblyName System.Windows.Forms
$h = [Vis]::Find("API Hub - Google Chrome")
[Vis]::ShowWindow($h, 9) | Out-Null
[Vis]::SetForegroundWindow($h) | Out-Null
Start-Sleep -Milliseconds 800
if ($Phase -eq "nav") {
  [Vis]::SetCursorPos(600,400) | Out-Null
  [Vis]::Ctrl(0x4C)
  Start-Sleep -Milliseconds 700
  Set-Clipboard -Value ("https://rapidapi.com/studio/" + $Guid + "/publish/general")
  [System.Windows.Forms.SendKeys]::SendWait("^v"); Start-Sleep -Milliseconds 400
  [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
  Start-Sleep -Seconds 14
  [Vis]::Click(900, 200)
  [System.Windows.Forms.SendKeys]::SendWait("^f"); Start-Sleep -Milliseconds 800
  [System.Windows.Forms.SendKeys]::SendWait("API Project is"); Start-Sleep -Milliseconds 1500
  [System.Windows.Forms.SendKeys]::SendWait("{ESC}"); Start-Sleep -Milliseconds 1200
  Write-Output "jumped to visibility"
}
