"""
Docker Sandbox for the Janitor Agent.

Provides isolated execution environment for running untrusted code.
"""

import docker
from docker.errors import DockerException


class DockerSandbox:
    """
    Docker-based sandbox for executing Python code safely.

    Runs code in ephemeral containers with limited resources.
    """

    def __init__(self) -> None:
        """
        Initialize the Docker client.

        If Docker is not running, sets self.available = False
        instead of crashing.
        """
        self.available = False
        self.client = None

        try:
            self.client = docker.from_env()
            # Test the connection by pinging Docker
            self.client.ping()
            self.available = True
        except DockerException as e:
            print(f"CRITICAL ERROR: Docker is not running. ({e})")
            self.available = False
        except Exception as e:
            print(f"CRITICAL ERROR: Could not connect to Docker. ({e})")
            self.available = False

    def run_code(self, code: str) -> str:
        """
        Execute Python code in an isolated Docker container.

        Args:
            code: The Python code to execute.

        Returns:
            The stdout/stderr output from the code execution.
            Returns an error message if sandbox is unavailable.
        """
        if not self.available or self.client is None:
            return "Error: Sandbox unavailable. Docker is not running."

        try:
            # Run code in a Python container
            output = self.client.containers.run(
                image="python:3.11-slim",
                command=["python", "-c", code],
                remove=True,  # Auto-remove container after execution
                network_disabled=True,  # No network access for security
                mem_limit="128m",  # Limit memory
                cpu_period=100000,
                cpu_quota=50000,  # Limit CPU to 50%
                stdout=True,
                stderr=True,
            )

            # Container.run returns bytes when stdout=True
            if isinstance(output, bytes):
                return output.decode("utf-8").strip()
            return str(output)

        except docker.errors.ContainerError as e:
            # Code raised an exception
            return f"Error: {e.stderr.decode('utf-8') if e.stderr else str(e)}"
        except docker.errors.ImageNotFound:
            return "Error: Python image not found. Run 'docker pull python:3.11-slim'"
        except docker.errors.APIError as e:
            return f"Error: Docker API error - {e}"
        except Exception as e:
            return f"Error: {str(e)}"
