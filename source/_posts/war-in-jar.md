---
date: "2015-04-28"
title: "War in jar with Maven"
tags: [ "java", "maven" ]
categories: [ "programming"]

---

# Intro

The following is one way you could go about packaging a war file in a jar file with [Maven](https://maven.apache.org/ "Maven). You might want to do this if you're loading a war file from the classpath programmatically.

For instance, assuming you had *myjar.jar* on the classpath and *myjar.jar* contained *mywar.war*, then you could refer to this war like so: `classpath://mywar.war`. Simply adding the directory containing your war file on the classpath (as you would to pick up _*.class_ files) would _not_ be enough to get a similar result.

# By example

To get something to work with, we can make use of the `maven-archetype-webapp` archetype:

```
$ mvn archetype:create  \
  -DgroupId=com.tmp \
  -DartifactId=warinjar \
  -DarchetypeArtifactId=maven-archetype-webapp
$ cd warinjar
```

Open up `pom.xml` in the generated project and change the `packaging` to `jar`:

```xml
<packaging>jar</packaging>
```

The final ingredient is to get the `maven-war-plugin` in on the action:

```xml
...
<build>
    <finalName>warinjar</finalName>
    <plugins>
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-war-plugin</artifactId>
            <version>2.6</version>
            <configuration>
                <outputDirectory>${project.build.directory}/classes</outputDirectory>
            </configuration>
            <executions>
                <execution>
                    <id>build-war-in-classes</id>
                    <phase>prepare-package</phase>
                    <goals>
                        <goal>war</goal>
                    </goals>
                </execution>
            </executions>
        </plugin>
    </plugins>
</build>
...
```

By setting the output directory to `${project.build.directory}/classes`, this plugin will generate `warinjar.war` in our `target/classes` directory, the contents of which are picked up when packaging our project (since we set the packaging to jar above).

Running `mvn clean package` will clean out previous build (by deleting the `target` directory). It will also execute `maven-war-plugin`'s `war` goal since we're executing it in the `prepare-package` lifecycle phase (which happens right before the `package` phase in [Maven's default lifecycle](https://maven.apache.org/guides/introduction/introduction-to-the-lifecycle.html#Lifecycle_Reference "Maven default lifecycle")).

This gives us `target/classes/warinjar.war` which then gets picked up when producing `target/warinjar.jar` (have a look at the jar's contents).

Of course, you could add another execution to also generate a war outside the jar:

```xml
...
<execution>
    <id>build-war</id>
    <phase>package</phase>
    <configuration>
        <outputDirectory>${project.build.directory}</outputDirectory>
        <warName>waroutjar</warName>
    </configuration>
    <goals>
        <goal>war</goal>
    </goals>
</execution>
...
```

Note that we need to overwrite the plugin's configuration for this execution. Have a look at the [documentation](https://maven.apache.org/plugins/maven-war-plugin/war-mojo.html "maven-war-plugin war-mojo") page for default values.

Basically, we're overwriting the default `outputDirectory` in our plugin's configuration, and so, the execution with id `build-war-in-classes` will output `${project.build.finalName}.war` (i.e. *warinjar.war*) to `${project.build.directory}/classes`.

Had we not overwritten the configuration in the plugin's execution with id `build-war`, we would have basically overwritten `target/classes/warinjar.war` with itself.

The final pom file looks like this:

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/maven-v4_0_0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.tmp</groupId>
    <artifactId>warinjar</artifactId>
    <packaging>jar</packaging>
    <version>1.0-SNAPSHOT</version>
    <build>
        <finalName>warinjar</finalName>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-war-plugin</artifactId>
                <version>2.6</version>
                <configuration>
                    <outputDirectory>${project.build.directory}/classes</outputDirectory>
                </configuration>
                <executions>
                    <execution>
                        <id>build-war-in-classes</id>
                        <phase>prepare-package</phase>
                        <goals>
                            <goal>war</goal>
                        </goals>
                    </execution>
                    <execution>
                        <id>build-war</id>
                        <phase>package</phase>
                        <configuration>
                            <outputDirectory>${project.build.directory}</outputDirectory>
                            <warName>waroutjar</warName>
                        </configuration>
                        <goals>
                            <goal>war</goal>
                        </goals>
                    </execution>
                </executions>
            </plugin>
        </plugins>
    </build>
</project>
```
