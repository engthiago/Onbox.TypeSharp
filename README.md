# Onbox.TypeSharp
Commandline app to convert CSharp data models into Typescript

## Advantages
* Do not depend o Visual Studio
* Dotnet 5 based, so it runs wherever dotnet runs
* Can be incorporated into MSBuild
* Can be incorporated into CI/CD
* Lightweight
* Can watch assemblies for changes

## Disadvantages
* Can not load runtime dependencies like Microsoft.AspNetCore.Mvc, so it can not run against ASP.NetCore assemblies

## Example 1
To convert all the types from one assembly and dump them into a models folder on the desktop:
```
TypeSharp.exe --source "C:\repos\Onbox.TypeSharp\samples\SampleModels\bin\Debug\netstandard2.0" --filter "SampleModels.dll" --destination "C:\Users\MyUser\Desktop\Models"
```

## Example 2
To convert all the types from all assemblies in a folder and dump them into a models folder on the desktop:
```
TypeSharp.exe --source "C:\repos\Onbox.TypeSharp\samples\SampleModels\bin\Debug\netstandard2.0" --filter "*.dll" --destination "C:\Users\MyUser\Desktop\Models"
```

## Example 3
Watch a assembly so everytime it changes, convert all the types and dump them into a modles folder on the desktop:
```
TypeSharp.exe --source "C:\repos\Onbox.TypeSharp\samples\SampleModels\bin\Debug\netstandard2.0" --filter "*.dll" --destination "C:\Users\MyUser\Desktop\Models"
```
