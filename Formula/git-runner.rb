class GitRunner < Formula
  desc "AI-powered automated Git operations tool"
  homepage "https://github.com/AI-S-Tools/git_runner"
  version "1.0.0"

  on_macos do
    url "https://github.com/AI-S-Tools/git_runner/releases/download/v#{version}/git_runner-macos"
    sha256 "PUT_MACOS_SHA256_HERE"  # Will be updated when release is created
  end

  on_linux do
    url "https://github.com/AI-S-Tools/git_runner/releases/download/v#{version}/git_runner-linux"
    sha256 "PUT_LINUX_SHA256_HERE"  # Will be updated when release is created
  end

  def install
    if OS.mac?
      bin.install "git_runner-macos" => "git_runner"
    else
      bin.install "git_runner-linux" => "git_runner"
    end
  end

  test do
    # Test that the binary can be executed
    system "#{bin}/git_runner", "--help"
  end
end