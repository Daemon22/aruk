# Retrieve stored GitHub credential from Windows Credential Manager
# and output the token to stdout (for piping to gh or curl)

# Use .NET to read Windows Credential Manager
Add-Type -AssemblyName System.Runtime.InteropServices

$sig = @'
using System;
using System.Runtime.InteropServices;
public class CredUtil {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct CREDENTIAL {
        public uint Flags;
        public uint Type;
        public IntPtr TypeName;
        public IntPtr TargetName;
        public IntPtr Comment;
        public IntPtr CommentResource;
        public IntPtr PersistTime;
        public IntPtr Parameter;
        public IntPtr Attributes;
        public uint AttributeCount;
        public uint FailFlags;
        public uint ValueSize;
        public uint CredSize;
        public IntPtr BitBlob;
        public IntPtr TargetAlias;
        public IntPtr UserName;
    }

    [DllImport("Advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool CredRead(string targetName, int type, int reserved, out IntPtr credentialPtr);

    [DllImport("Advapi32.dll", SetLastError = true)]
    public static extern void CredFree(IntPtr cred);

    public static Tuple<string, string> Read(string target) {
        IntPtr credPtr;
        if (CredRead(target, 1, 0, out credPtr)) {
            try {
                var cred = Marshal.PtrToStructure<CREDENTIAL>(credPtr);
                string userName = cred.UserName != IntPtr.Zero ? Marshal.PtrToStringUni(cred.UserName) : "";
                string password = cred.BitBlob != IntPtr.Zero ? Marshal.PtrToStringUni(cred.BitBlob, (int)cred.CredSize) : "";
                return new Tuple<string, string>(userName, password);
            } finally {
                CredFree(credPtr);
            }
        }
        return null;
    }
}
'@

Add-Type -TypeDefinition $sig

# Try to read the GitHub credential
$targets = @(
    "GitHub - https://api.github.com/Daemon22",
    "git:https://Daemon22@github.com",
    "git:https://github.com"
)

foreach ($target in $targets) {
    $result = [CredUtil]::Read($target)
    if ($result -ne $null) {
        Write-Host "Found credential for target: $target"
        Write-Host "Username: " $result.Item1
        Write-Host "Password length: " $result.Item2.Length
        # Output the token for use by other commands
        Write-Output $result.Item2
        break
    }
}
