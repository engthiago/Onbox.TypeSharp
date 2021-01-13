@echo off
"bin\Debug\net5.0\win-x86\TypeSharp.exe" --version
"bin\Debug\net5.0\win-x86\TypeSharp.exe" --source "..\..\samples\SampleModels\bin\Debug\netstandard2.0" --file-filter "SampleModels.dll" --destination "..\..\samples\SampleModels\Typescript"