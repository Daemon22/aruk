using System;
using System.Runtime.InteropServices;
using System.Text;

public class CredReader {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct CREDENTIAL {
        public uint Flags;
        public uint Type;
        public string TypeName;
        public string TargetName;
        public string Comment;
        public string CommentResource;
        public string PersistTime;
        public string Parameter;
        public IntPtr Attributes;
        public uint AttributeCount;
        public uint FailFlags;
        public uint ValueSize;
        public uint CredSize;
        public IntPtr BitBlob;
        public string TargetAlias;
        public string UserName;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct CREDENTIAL_ATTRIBUTEF {
        public string Keyword;
        public uint Flags;
        public uint ValueSize;
        public IntPtr Value;
    }

    [DllImport("Advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool CredRead(string targetName, int type, int reserved, out IntPtr credentialPtr);

    [DllImport("Advapi32.dll", SetLastError = true)]
    public static extern void CredFree(IntPtr cred);

    public static string ReadCredential(string target) {
        IntPtr credPtr;
        if (CredRead(target, 1, 0, out credPtr)) {
            try {
                var cred = Marshal.PtrToStructure<CREDENTIAL>(credPtr);
                return cred.UserName;
            } finally {
                CredFree(credPtr);
            }
        }
        return null;
    }
}
