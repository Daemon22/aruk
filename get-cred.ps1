Add-Type -AssemblyName System.Runtime.InteropServices

# P/Invoke to read credentials from Windows Credential Manager
$signature = @'
using System;
using System.Runtime.InteropServices;
public class CredUtil {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct CREDENTIAL {
        public uint Flags;
        public uint Type;
        public string TypeName;
        public string TargetName;
        public string Comment;
        public string PersistTime;
        public string Parameter;
        public string Attributes;
        public uint AttributeCount;
        public uint FailFlags;
        public string ValueSize;
        public uint CredSize;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string TargetAlias;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string UserName;
    }
}
'@;

# We'll use a simpler approach: try to find the credential using cmdkey or .NET
# The key insight: use net use or git to trigger the credential manager

# Try using the .NET Credential class
function Get-StoredCred {
    $cred = Get-Credential -Message "Enter your GitHub credentials" -UserName "Daemon22" -ErrorAction SilentlyContinue
    return $cred
}

# Check for CredentialManager module
$cm = Get-Module -ListAvailable CredentialManager -ErrorAction SilentlyContinue
if ($cm) {
    Write-Host "CredentialManager module found"
} else {
    Write-Host "CredentialManager module not found"
}

# Try to install it
try {
    Install-Module -Name CredentialManager -Force -Scope CurrentUser -AllowClobber -ErrorAction SilentlyContinue
    Write-Host "Attempting to install CredentialManager..."
} catch {
    Write-Host "Cannot install CredentialManager: $_"
}
